export function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function displayName(user: { address: string; nickname: string }): string {
  return user.nickname.trim() || shortAddress(user.address);
}

export function relativeTime(iso: string): string {
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return '';

  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return '刚刚';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}
