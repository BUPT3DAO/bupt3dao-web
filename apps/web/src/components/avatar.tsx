import { shortAddress } from '@/lib/format';

interface AvatarProps {
  address: string;
  nickname?: string;
  src?: string | null;
  size?: number;
}

function hueFromAddress(address: string): number {
  let hash = 0;
  for (let index = 2; index < address.length; index += 1) {
    hash = (hash * 31 + address.charCodeAt(index)) % 360;
  }
  return hash;
}

export function Avatar({ address, nickname, src, size = 40 }: AvatarProps) {
  const style = { width: size, height: size };

  if (src) {
    return (
      // 头像是用户上传的文件，经同源 /uploads 代理返回，不需要 Next 图片优化
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="avatar"
        src={src}
        alt={nickname?.trim() || shortAddress(address)}
        style={style}
      />
    );
  }

  const label = (nickname?.trim() || address.slice(2, 4)).slice(0, 2).toUpperCase();
  // 固定压低背景明度，保证所有色相上的白字都达到 WCAG AA 对比度。
  return (
    <span
      className="avatar avatar-fallback"
      style={{ ...style, backgroundColor: `hsl(${hueFromAddress(address)} 58% 28%)` }}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}
