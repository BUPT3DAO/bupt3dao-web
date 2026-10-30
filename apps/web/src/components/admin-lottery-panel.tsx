'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { Markdown } from '@/components/markdown';
import { ApiError, api } from '@/lib/api';
import { displayName, shortAddress } from '@/lib/format';
import type { LotteryAdmin, LotteryCampaignPayload, LotteryPrize, LotteryRecord } from '@/types';

const RECORDS_PAGE = 20;
const emptySettings: LotteryCampaignPayload = { title: '', description: '', is_open: false };
const emptyPrize = { name: '', weight: '1' };
type PrizeForm = typeof emptyPrize;

function recordTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

export function AdminLotteryPanel() {
  const [data, setData] = useState<LotteryAdmin | null>(null);
  const [settings, setSettings] = useState<LotteryCampaignPayload>(emptySettings);
  const [prize, setPrize] = useState<PrizeForm>(emptyPrize);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [records, setRecords] = useState<LotteryRecord[]>([]);
  const [recordTotal, setRecordTotal] = useState(0);
  const [recordPage, setRecordPage] = useState(0);
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [version, setVersion] = useState(0);

  function apply(result: LotteryAdmin) {
    setData(result);
    if (result.campaign) {
      const { title, description, is_open } = result.campaign;
      setSettings({ title, description, is_open });
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([api.adminLottery(controller.signal), api.lotteryRecords(recordPage * RECORDS_PAGE, controller.signal)])
      .then(([lottery, list]) => {
        if (!active) return;
        apply(lottery);
        setRecords(list.items);
        setRecordTotal(list.total);
      })
      .catch((cause) => {
        if (active && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : '加载失败');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [recordPage, version]);

  async function run(action: () => Promise<LotteryAdmin>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      apply(await action());
      setNotice(success);
      setVersion((value) => value + 1);
      return true;
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '操作失败，请稍后重试');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!settings.title.trim()) {
      setError('请填写标题');
      return;
    }
    void run(() => api.saveLottery(settings), '已保存');
  }

  async function savePrize(event: FormEvent) {
    event.preventDefault();
    const payload = { name: prize.name.trim(), weight: Math.max(0, Math.round(Number(prize.weight) || 0)) };
    if (!payload.name) {
      setError('请填写选项名称');
      return;
    }
    const ok = await run(
      () => (editingId === null ? api.addLotteryPrize(payload) : api.updateLotteryPrize(editingId, payload)),
      editingId === null ? '已添加' : '已更新',
    );
    if (ok) {
      setPrize(emptyPrize);
      setEditingId(null);
    }
  }

  function removePrize(item: LotteryPrize) {
    if (!window.confirm(`删除「${item.name}」？`)) return;
    if (editingId === item.id) {
      setEditingId(null);
      setPrize(emptyPrize);
    }
    void run(() => api.deleteLotteryPrize(item.id), '已删除');
  }

  function newRound() {
    if (!window.confirm('开始新一轮？')) return;
    setRecordPage(0);
    void run(() => api.newLotteryRound(), '已开始新一轮');
  }

  async function toggleDelivered(item: LotteryRecord) {
    setBusy(true);
    setError('');
    try {
      const updated = await api.markLotteryDelivered(item.id, !item.delivered);
      setRecords((list) => list.map((row) => (row.id === item.id ? { ...row, delivered: updated.delivered } : row)));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '操作失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="card loading-card"><div className="skeleton" /><div className="skeleton" /></div>;
  }

  const campaign = data?.campaign ?? null;

  return (
    <div className="admin-lottery">
      {notice && <div className="success-notice" role="status"><Icon name="check" size={16} />{notice}</div>}
      {error && <div className="inline-notice" role="alert">{error}</div>}

      {campaign && (
        <div className="admin-lottery-stats">
          <div className="card"><span>状态</span><strong className={campaign.is_open ? 'is-open' : ''}>{campaign.is_open ? '进行中' : '已关闭'}</strong></div>
          <div className="card"><span>参与人数</span><strong>{data?.participants ?? 0}</strong></div>
          <div className="card"><span>抽奖次数</span><strong>{data?.total_draws ?? 0}</strong></div>
        </div>
      )}

      <form className="card admin-lottery-card" onSubmit={saveSettings}>
        <div className="admin-event-editor-heading">
          <h3>{campaign ? '设置' : '创建抽奖'}</h3>
          <div className="admin-event-editor-actions">
            <Link className="btn btn-ghost btn-sm" href="/lottery">查看抽奖页</Link>
            {campaign && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={newRound}>开始新一轮</button>}
          </div>
        </div>
        <label className="field">标题<input className="input" maxLength={80} value={settings.title} onChange={(event) => setSettings({ ...settings, title: event.target.value })} /></label>
        <div className="field event-markdown-field">
          <div className="event-field-heading"><span>说明（Markdown）</span><button type="button" className="text-link" onClick={() => setPreview(!preview)}>{preview ? '继续编辑' : '预览'}</button></div>
          {preview ? <div className="event-markdown-preview"><Markdown source={settings.description} /></div> : <textarea className="textarea" maxLength={2000} value={settings.description} onChange={(event) => setSettings({ ...settings, description: event.target.value })} />}
        </div>
        <div className="admin-event-editor-actions">
          <label className="lottery-check">
            <input type="checkbox" checked={settings.is_open} onChange={(event) => setSettings({ ...settings, is_open: event.target.checked })} />
            开放抽奖
          </label>
          <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? '保存中…' : campaign ? '保存' : '创建'}</button>
        </div>
      </form>

      {campaign && (
        <section className="card admin-lottery-card">
          <h3>转盘选项</h3>
          {campaign.prizes.length > 0 && (
            <div className="hb-table admin-lottery-table">
              <table>
                <thead><tr><th>选项</th><th>权重</th><th>概率</th><th /></tr></thead>
                <tbody>
                  {campaign.prizes.map((item) => (
                    <tr key={item.id} className={editingId === item.id ? 'is-editing' : ''}>
                      <td>{item.name}</td>
                      <td>{item.weight}</td>
                      <td>{item.chance}%</td>
                      <td className="admin-lottery-row-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditingId(item.id); setPrize({ name: item.name, weight: String(item.weight) }); setError(''); setNotice(''); }}>编辑</button>
                        <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => removePrize(item)}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <form className="admin-lottery-prize-form" onSubmit={savePrize}>
            <label className="field">名称<input className="input" maxLength={60} value={prize.name} onChange={(event) => setPrize({ ...prize, name: event.target.value })} /></label>
            <label className="field">权重<input className="input" type="number" min={0} value={prize.weight} onChange={(event) => setPrize({ ...prize, weight: event.target.value })} /></label>
            <div className="admin-lottery-prize-actions">
              {editingId !== null && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditingId(null); setPrize(emptyPrize); }}>取消</button>}
              <button className="btn btn-primary btn-sm" disabled={busy}><Icon name={editingId === null ? 'plus' : 'check'} size={15} />{editingId === null ? '添加' : '保存'}</button>
            </div>
          </form>
        </section>
      )}

      {campaign && (
        <section className="card admin-lottery-card">
          <div className="admin-event-editor-heading">
            <h3>抽奖记录</h3>
            <span className="muted">{recordTotal} 条</span>
          </div>
          {records.length > 0 && (
            <ul className="admin-lottery-winners">
              {records.map((item) => (
                <li key={item.id}>
                  <Link className="admin-lottery-winner" href={`/u/${item.user.address}`}>
                    <Avatar address={item.user.address} nickname={item.user.nickname} src={item.user.avatar_url} size={32} />
                    <span><b>{displayName(item.user)}</b>{item.user.nickname.trim() && <small className="mono">{shortAddress(item.user.address)}</small>}</span>
                  </Link>
                  <span className="admin-lottery-winner-prize">{item.prize_name}<small>{recordTime(item.created_at)}</small></span>
                  <button className={`btn btn-sm ${item.delivered ? 'btn-soft' : 'btn-ghost'}`} disabled={busy} onClick={() => void toggleDelivered(item)}>
                    {item.delivered ? <><Icon name="check" size={14} />已发放</> : '发放'}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {recordTotal > RECORDS_PAGE && <div className="pagination"><button className="btn btn-ghost btn-sm" disabled={recordPage === 0} onClick={() => setRecordPage((n) => n - 1)}>上一页</button><span>第 {recordPage + 1} 页</span><button className="btn btn-ghost btn-sm" disabled={(recordPage + 1) * RECORDS_PAGE >= recordTotal} onClick={() => setRecordPage((n) => n + 1)}>下一页</button></div>}
        </section>
      )}
    </div>
  );
}
