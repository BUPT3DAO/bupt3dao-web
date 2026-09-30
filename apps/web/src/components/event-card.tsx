import Link from 'next/link';

import { Icon } from '@/components/icon';
import { EventFollowControl } from '@/components/event-follow-control';
import type { CommunityEvent } from '@/types';

export function eventDate(value: string | null): string {
  if (!value) return '时间待定';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

export function EventCard({ event, onFollowChange }: { event: CommunityEvent; onFollowChange?: (followed: boolean) => void }) {
  const badge =
    event.publication_status === 'draft'
      ? '活动已撤回'
      : event.event_state === 'cancelled'
      ? '已取消'
      : event.event_state === 'ended'
        ? '往期活动'
        : event.event_state === 'ongoing'
          ? '进行中'
          : '即将开始';

  return (
    <article className="card event-card">
      <div className="event-card-topline">
        <span className={`event-state event-state-${event.event_state}`}>{badge}</span>
        <span className="event-timezone">UTC+8</span>
      </div>
      <h2><Link href={`/events/${event.id}`}>{event.title}</Link></h2>
      <p className="event-card-summary">{event.summary || event.content.replace(/[#>*_`~|]/g, '').slice(0, 160)}</p>
      <div className="event-card-meta">
        <span><Icon name="clock" size={15} />{eventDate(event.starts_at)}</span>
        <span><Icon name="pin" size={15} />{event.location}</span>
        <span><Icon name="user" size={15} />{event.organizer}</span>
      </div>
      <Link className="text-link" href={`/events/${event.id}`}>
        查看活动 <Icon name="arrow" size={15} />
      </Link>
      <EventFollowControl event={event} onChange={onFollowChange} />
    </article>
  );
}
