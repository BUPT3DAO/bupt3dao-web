"""钱包登录（SIWE / EIP-4361）。

消息文本由本模块生成，校验时按同一份格式严格解析，只依赖 eth-account，
不引入 web3 全家桶。
"""

import secrets
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
    nonce: str
    expiration: datetime | None


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
    if not lines[0].endswith(_HEADER_SUFFIX):
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
        fields[key] = value

    for required in ("Version", "Chain ID", "Nonce", "Issued At"):
        if required not in fields:
            raise SiweError(f"消息缺少 {required} 字段")

    expiration = fields.get("Expiration Time")
    return ParsedMessage(
        domain=domain,
        address=lines[1],
        nonce=fields["Nonce"],
        expiration=_parse_rfc3339(expiration) if expiration else None,
    )


def verify_message(message: str, signature: str, expected_nonce: str | None) -> str:
    """校验 nonce / 域名 / 有效期 / 签名，返回小写地址。"""
    parsed = parse_message(message)

    if expected_nonce is None or parsed.nonce != expected_nonce:
        raise SiweError("登录挑战已失效，请重新签名")
    if parsed.domain != settings.siwe_domain:
        raise SiweError("签名域名不匹配")
    if parsed.expiration is not None and parsed.expiration < datetime.now(timezone.utc):
        raise SiweError("签名已过期，请重新签名")

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

    def issue(self, address: str) -> str:
        self._purge()
        nonce = secrets.token_hex(16)
        self._items[address] = (nonce, time.monotonic() + self._ttl)
        return nonce

    def consume(self, address: str) -> str | None:
        """取出并作废该地址的 nonce（一次性）。"""
        self._purge()
        item = self._items.pop(address, None)
        return item[0] if item else None

    def _purge(self) -> None:
        now = time.monotonic()
        for key in [key for key, (_, expires) in self._items.items() if expires < now]:
            self._items.pop(key, None)


nonce_store = NonceStore(settings.nonce_ttl_seconds)
