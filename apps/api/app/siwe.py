"""钱包登录（SIWE / EIP-4361）。

消息文本由本模块生成，校验时按同一份格式严格解析，只依赖 eth-account，
不引入 web3 全家桶。
"""

import secrets
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import is_address, to_checksum_address

from app.config import settings

_HEADER_SUFFIX = " wants you to sign in with your Ethereum account:"


class SiweError(Exception):
    """SIWE 消息不合法或签名校验失败。"""


@dataclass(frozen=True)
class ParsedMessage:
    domain: str
    address: str
    uri: str
    version: str
    chain_id: int
    issued_at: datetime
    nonce: str
    expiration: datetime


def _rfc3339(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _parse_rfc3339(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise SiweError("时间字段格式不正确") from exc
    if parsed.tzinfo is None:
        raise SiweError("时间字段缺少时区")
    return parsed


def normalize_address(address: str) -> str:
    """校验并归一化为小写地址，非法时抛 SiweError。"""
    if not isinstance(address, str) or not is_address(address):
        raise SiweError("钱包地址格式不正确")
    return address.lower()


def build_message(address: str, nonce: str) -> str:
    """按 EIP-4361 拼装待签名消息。"""
    issued_at = datetime.now(timezone.utc)
    lines = [
        f"{settings.siwe_domain}{_HEADER_SUFFIX}",
        to_checksum_address(address),
        "",
    ]
    if settings.siwe_statement:
        lines += [settings.siwe_statement, ""]
    lines += [
        f"URI: {settings.siwe_uri}",
        "Version: 1",
        f"Chain ID: {settings.siwe_chain_id}",
        f"Nonce: {nonce}",
        f"Issued At: {_rfc3339(issued_at)}",
        f"Expiration Time: {_rfc3339(issued_at + timedelta(seconds=settings.nonce_ttl_seconds))}",
    ]
    return "\n".join(lines)


def parse_message(message: str) -> ParsedMessage:
    """解析 EIP-4361 消息；只取安全相关字段，格式不符即视为非法。"""
    lines = message.split("\n")
    if not lines or not lines[0].endswith(_HEADER_SUFFIX):
        raise SiweError("消息头部格式不正确")
    domain = lines[0][: -len(_HEADER_SUFFIX)]
    if len(lines) < 2 or not is_address(lines[1]):
        raise SiweError("消息中的钱包地址不合法")

    # "URI:" 之后是固定的键值对区，声明（statement）里可能含冒号，必须从这里开始解析
    start = next((i for i, line in enumerate(lines) if line.startswith("URI: ")), None)
    if start is None:
        raise SiweError("消息缺少 URI 字段")

    fields: dict[str, str] = {}
    for line in lines[start:]:
        key, sep, value = line.partition(": ")
        if not sep:
            raise SiweError("消息字段格式不正确")
        if key in fields:
            raise SiweError("消息字段重复")
        fields[key] = value

    for required in ("URI", "Version", "Chain ID", "Nonce", "Issued At", "Expiration Time"):
        if required not in fields:
            raise SiweError(f"消息缺少 {required} 字段")

    try:
        chain_id = int(fields["Chain ID"])
    except ValueError as exc:
        raise SiweError("Chain ID 字段格式不正确") from exc

    return ParsedMessage(
        domain=domain,
        address=lines[1],
        uri=fields["URI"],
        version=fields["Version"],
        chain_id=chain_id,
        issued_at=_parse_rfc3339(fields["Issued At"]),
        nonce=fields["Nonce"],
        expiration=_parse_rfc3339(fields["Expiration Time"]),
    )


def verify_message(message: str, signature: str, expected_nonce: str | None) -> str:
    """校验 nonce / 域名 / 有效期 / 签名，返回小写地址。"""
    parsed = parse_message(message)

    if expected_nonce is None or parsed.nonce != expected_nonce:
        raise SiweError("登录挑战已失效，请重新签名")
    if parsed.domain != settings.siwe_domain:
        raise SiweError("签名域名不匹配")
    if parsed.uri != settings.siwe_uri:
        raise SiweError("签名 URI 不匹配")
    if parsed.version != "1":
        raise SiweError("签名版本不受支持")
    if parsed.chain_id != settings.siwe_chain_id:
        raise SiweError("签名网络不匹配")

    now = datetime.now(timezone.utc)
    if parsed.issued_at > now + timedelta(seconds=30):
        raise SiweError("签名时间来自未来")
    if parsed.issued_at < now - timedelta(seconds=settings.nonce_ttl_seconds):
        raise SiweError("签名已过期，请重新签名")
    if parsed.expiration < now:
        raise SiweError("签名已过期，请重新签名")
    if parsed.expiration <= parsed.issued_at:
        raise SiweError("签名有效期不正确")
    if (parsed.expiration - parsed.issued_at).total_seconds() > settings.nonce_ttl_seconds:
        raise SiweError("签名有效期超过允许范围")

    try:
        # 签名来自不可信输入，任何解析异常都统一按校验失败处理
        recovered = Account.recover_message(encode_defunct(text=message), signature=signature)
    except Exception as exc:
        raise SiweError("签名格式无法解析") from exc

    if recovered.lower() != parsed.address.lower():
        raise SiweError("签名与钱包地址不匹配")
    return parsed.address.lower()


class NonceStore:
    """内存中的一次性 nonce 存储。

    单实例部署足够；将来多实例横向扩展时需要换成 Redis 等共享存储。
    """

    def __init__(self, ttl_seconds: int) -> None:
        self._ttl = ttl_seconds
        self._items: dict[str, tuple[str, float]] = {}
        self._lock = threading.Lock()

    def issue(self, address: str) -> str:
        with self._lock:
            self._purge()
            nonce = secrets.token_hex(16)
            self._items[address] = (nonce, time.monotonic() + self._ttl)
            return nonce

    def peek(self, address: str) -> str | None:
        """读取 nonce 但不作废；只有完整验签通过后才允许消费。"""
        with self._lock:
            self._purge()
            item = self._items.get(address)
            return item[0] if item else None

    def consume_if_matches(self, address: str, nonce: str) -> bool:
        """验签成功后原子地消费匹配的 nonce，阻止并发重放。"""
        with self._lock:
            self._purge()
            item = self._items.get(address)
            if item is None or item[0] != nonce:
                return False
            del self._items[address]
            return True

    def consume(self, address: str) -> str | None:
        """取出并作废该地址的 nonce（一次性）。"""
        with self._lock:
            self._purge()
            item = self._items.pop(address, None)
            return item[0] if item else None

    def _purge(self) -> None:
        now = time.monotonic()
        for key in [key for key, (_, expires) in self._items.items() if expires < now]:
            self._items.pop(key, None)


nonce_store = NonceStore(settings.nonce_ttl_seconds)
