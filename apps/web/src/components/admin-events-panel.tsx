'use client';

import { useEffect, useState, type FormEvent } from 'react';

import { eventDate } from '@/components/event-card';
import { Icon } from '@/components/icon';
import { Markdown } from '@/components/markdown';
import { ApiError, api } from '@/lib/api';
import type { CommunityEvent, CommunityEventPayload } from '@/types';

const emptyPayload: CommunityEventPayload = {
  title: '', summary: '', content: '', organizer: '', location: '', starts_at: null,
  ends_at: null, registration_url: null, registration_deadline: null, materials: '',
};

function localInput(value: string | null): string {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

function utcValue(value: string): string | null {
  return value ? `${value}:00+08:00` : null;
}

function payloadFromEvent(event: CommunityEvent): CommunityEventPayload {
  return {
    title: event.title, summary: event.summary, content: event.content,
    organizer: event.organizer, location: event.location, starts_at: event.starts_at,
    ends_at: event.ends_at, registration_url: event.registration_url,
    registration_deadline: event.registration_deadline, materials: event.materials,
  };
}

function statusLabel(event: CommunityEvent): string {
  if (event.publication_status === 'draft') return '草稿';
  if (event.publication_status === 'cancelled') return '已取消';
  return event.event_state === 'ended' ? '已结束' : event.event_state === 'ongoing' ? '进行中' : '已发布';
}

export function AdminEventsPanel() {
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<CommunityEvent | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [payload, setPayload] = useState<CommunityEventPayload>(emptyPayload);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    api.adminEvents(query, page * 12, controller.signal)
      .then((data) => {
        if (!active) return;
        setEvents(data.items);
        setTotal(data.total);
      })
      .catch((cause) => {
        if (active && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : '活动加载失败');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [query, page, version]);

  function startNew() {
    setEditorOpen(true);
    setSelected(null);
    setPayload(emptyPayload);
    setPreview(false);
    setError('');
    setNotice('');
  }

  function update<K extends keyof CommunityEventPayload>(key: K, value: CommunityEventPayload[K]) {
    setPayload((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const requestPayload: CommunityEventPayload = {
      ...payload,
      starts_at: utcValue(localInput(payload.starts_at)),
      ends_at: utcValue(localInput(payload.ends_at)),
      registration_deadline: utcValue(localInput(payload.registration_deadline)),
      registration_url: payload.registration_url?.trim() || null,
    };
    try {
      const result = selected
        ? await api.updateEvent(selected.id, requestPayload)
        : await api.createEvent(requestPayload);
      setSelected(result);
      setEditorOpen(true);
      setPayload(payloadFromEvent(result));
      setNotice(result.publication_status === 'published'
        ? result.followers_notified
          ? `修改已发布，已通知 ${result.followers_notified} 位关注成员`
          : '修改已发布'
        : '活动已保存为草稿');
      setVersion((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  }

  async function transition(action: 'publish' | 'withdraw' | 'cancel', event: CommunityEvent) {
    let reason = '';
    if (action === 'cancel') {
      const value = window.prompt('请填写取消原因（会向登录成员公开）');
      if (value === null) return;
      reason = value.trim();
      if (!reason) {
        setError('取消活动需要填写原因');
        return;
      }
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = action === 'publish'
        ? await api.publishEvent(event.id)
        : action === 'withdraw'
          ? await api.withdrawEvent(event.id)
          : await api.cancelEvent(event.id, reason);
      setNotice(action === 'publish' ? '活动已发布' : action === 'withdraw' ? '活动已撤回为草稿' : '活动已取消');
      if (selected?.id === event.id) {
        setSelected(result);
        setPayload(payloadFromEvent(result));
        if (action === 'cancel') setEditorOpen(false);
      }
      setVersion((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '操作失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setQuery(search.trim());
    setPage(0);
  }

  const field = <K extends keyof CommunityEventPayload>(key: K, value: CommunityEventPayload[K]) => update(key, value);

  return (
    <div className="admin-events">
      <div className="admin-events-toolbar">
        <form className="admin-search" onSubmit={submitSearch}>
          <label className="search-field"><Icon name="search" size={16} /><input value={search} maxLength={100} placeholder="搜索活动标题" aria-label="搜索活动标题" onChange={(event) => setSearch(event.target.value)} /></label>
          <button className="btn btn-primary btn-sm" type="submit">搜索</button>
          <span className="muted">共 {total} 场</span>
        </form>
        <button className="btn btn-primary btn-sm" onClick={startNew}><Icon name="plus" size={15} />新建活动</button>
      </div>
      {notice && <div className="success-notice" role="status"><Icon name="check" size={16} />{notice}</div>}
      {error && <div className="inline-notice" role="alert">{error}</div>}
      {editorOpen ? (
        <form className="card admin-event-editor" onSubmit={save}>
          <div className="admin-event-editor-heading"><div><span className="eyebrow">{selected ? `EVENT #${selected.id}` : 'NEW EVENT'}</span><h3>{selected ? '编辑活动' : '新建活动'}</h3><p>时间按北京时间（UTC+8）填写。</p></div><div className="admin-event-editor-actions"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditorOpen(false)}>关闭</button><button type="button" className="btn btn-ghost btn-sm" onClick={startNew}>新建另一场</button></div></div>
          <div className="event-form-grid">
            <label className="field">活动标题<input className="input" maxLength={140} value={payload.title} onChange={(event) => field('title', event.target.value)} /></label>
            <label className="field">主办方<input className="input" maxLength={120} value={payload.organizer} onChange={(event) => field('organizer', event.target.value)} /></label>
            <label className="field event-form-wide">摘要<input className="input" maxLength={300} value={payload.summary} onChange={(event) => field('summary', event.target.value)} /></label>
            <label className="field">开始时间（UTC+8）<input className="input" type="datetime-local" value={localInput(payload.starts_at)} onChange={(event) => field('starts_at', utcValue(event.target.value))} /></label>
            <label className="field">结束时间（UTC+8）<input className="input" type="datetime-local" value={localInput(payload.ends_at)} onChange={(event) => field('ends_at', utcValue(event.target.value))} /></label>
            <label className="field">地点<input className="input" maxLength={200} value={payload.location} onChange={(event) => field('location', event.target.value)} /></label>
            <label className="field">外部报名链接（HTTPS）<input className="input" type="url" placeholder="https://…" value={payload.registration_url ?? ''} onChange={(event) => field('registration_url', event.target.value || null)} /></label>
            <label className="field event-form-wide">报名截止（UTC+8；留空则截止到活动开始）<input className="input" type="datetime-local" value={localInput(payload.registration_deadline)} onChange={(event) => field('registration_deadline', utcValue(event.target.value))} /></label>
          </div>
          <div className="field event-markdown-field"><div className="event-field-heading"><span>活动介绍（Markdown）</span><button type="button" className="text-link" onClick={() => setPreview(!preview)}>{preview ? '继续编辑' : '预览'}</button></div>{preview ? <div className="event-markdown-preview"><Markdown source={payload.content} /></div> : <textarea className="textarea" maxLength={20000} value={payload.content} onChange={(event) => field('content', event.target.value)} placeholder="活动目的、议程、参与方式……" />}</div>
          <div className="field event-markdown-field"><label htmlFor="event-materials">活动资料与复盘（Markdown）</label><textarea id="event-materials" className="textarea" maxLength={20000} value={payload.materials} onChange={(event) => field('materials', event.target.value)} placeholder="活动结束后补充讲义、录像和复盘链接" /></div>
          <div className="admin-event-editor-actions"><button className="btn btn-primary btn-sm" disabled={saving}>{saving ? '保存中…' : '保存草稿'}</button>{selected?.publication_status === 'draft' && <button type="button" className="btn btn-soft btn-sm" disabled={saving} onClick={() => void transition('publish', selected)}>发布活动</button>}{selected?.publication_status === 'published' && <><button type="button" className="btn btn-soft btn-sm" disabled={saving} onClick={() => void transition('withdraw', selected)}>撤回为草稿</button><button type="button" className="btn btn-danger btn-sm" disabled={saving} onClick={() => void transition('cancel', selected)}>取消活动</button></>}</div>
          {selected?.publication_status === 'cancelled' && <p className="event-closed-note">已取消的活动保留公开记录，不能再次编辑或发布。</p>}
        </form>
      ) : null}
      {loading ? <div className="card loading-card"><div className="skeleton" /></div> : events.length ? <div className="admin-event-list">{events.map((event) => <article className="card admin-event-row" key={event.id}><div><span className={`event-state event-state-${event.event_state}`}>{statusLabel(event)}</span><h3>{event.title || '未命名活动'}</h3><p>{event.starts_at ? `${eventDate(event.starts_at)} · ${event.location}` : '时间待定'} <small>UTC+8</small></p>{event.publication_status === 'cancelled' && <p className="event-closed-note">取消原因：{event.cancellation_reason}</p>}</div><div className="admin-event-row-actions">{event.publication_status !== 'cancelled' && <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(event); setPayload(payloadFromEvent(event)); setEditorOpen(true); setPreview(false); setError(''); setNotice(''); }}>编辑</button>}{event.publication_status === 'draft' && <button className="btn btn-soft btn-sm" disabled={saving} onClick={() => void transition('publish', event)}>发布</button>}{event.publication_status === 'published' && <><button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => void transition('withdraw', event)}>撤回</button><button className="btn btn-danger btn-sm" disabled={saving} onClick={() => void transition('cancel', event)}>取消</button></>}</div></article>)}</div> : !error ? <div className="card empty-state"><div className="empty-art"><Icon name="calendar" size={30} /></div><h3>还没有活动</h3><p>创建一场活动草稿，然后完善信息并发布。</p></div> : null}
      {total > 12 && <div className="pagination"><button className="btn btn-ghost btn-sm" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}>上一页</button><span>第 {page + 1} 页</span><button className="btn btn-ghost btn-sm" disabled={(page + 1) * 12 >= total || loading} onClick={() => setPage((value) => value + 1)}>下一页</button></div>}
    </div>
  );
}
