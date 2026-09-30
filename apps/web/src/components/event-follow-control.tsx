'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import type { CommunityEvent } from '@/types';

type Reminder = 'none' | '1h' | '24h_1h';

export function EventFollowControl({ event, onChange }: { event: CommunityEvent; onChange?: (followed: boolean) => void }) {
  const [followed, setFollowed] = useState(event.followed);
  const [reminder, setReminder] = useState<Reminder>(event.reminder_preference ?? '1h');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setFollowed(event.followed);
    setReminder(event.reminder_preference ?? '1h');
  }, [event.id, event.followed, event.reminder_preference]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (followed) {
        await api.unfollowEvent(event.id);
        setFollowed(false);
        onChange?.(false);
      } else {
        const result = await api.followEvent(event.id, reminder);
        setFollowed(result.followed);
        setReminder(result.reminder_preference);
        onChange?.(result.followed);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  }

  async function updateReminder(value: Reminder) {
    const previous = reminder;
    setReminder(value);
    if (!followed || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.followEvent(event.id, value);
      setReminder(result.reminder_preference);
    } catch (cause) {
      setReminder(previous);
      setError(cause instanceof Error ? cause.message : '提醒设置保存失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="event-follow-control">
      <button className={followed ? 'btn btn-ghost btn-sm' : 'btn btn-soft btn-sm'} disabled={busy || (event.publication_status !== 'published' && !followed)} onClick={() => void toggle()}>
        {busy ? '保存中…' : followed ? '已关注 · 取消关注' : event.publication_status === 'draft' ? '活动已撤回' : event.publication_status === 'cancelled' ? '活动已取消' : '关注活动'}
      </button>
      {followed && event.publication_status !== 'cancelled' && <label className="event-reminder-setting">站内开场提醒
        <select className="input" value={reminder} disabled={busy || event.event_state === 'ended'} onChange={(change) => void updateReminder(change.target.value as Reminder)}>
          <option value="none">不提醒</option>
          <option value="1h">提前 1 小时</option>
          <option value="24h_1h">提前 24 小时和 1 小时</option>
        </select>
        <small>活动变更通知始终开启；提醒只在站内消息中显示。</small>
      </label>}
      {error && <small className="event-follow-error" role="alert">{error}</small>}
    </div>
  );
}
