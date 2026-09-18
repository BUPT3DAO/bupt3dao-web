export function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** 入学年份按「20xx 级」展示，没填就是空字符串 */
export function cohortLabel(cohort: string): string {
  const value = cohort.trim();
  return value ? `${value} 级` : '';
}

/** 昵称下面那一行：入学年份 · 学院 · 专业 */
export function userMetaLine(user: {
  cohort: string;
  school: string;
  major: string;
}): string {
  return [cohortLabel(user.cohort), user.school.trim(), user.major.trim()]
    .filter(Boolean)
    .join(' · ');
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

/** 个人链接没写名称时，用域名兜底展示。 */
export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
