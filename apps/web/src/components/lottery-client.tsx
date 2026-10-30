'use client';

import { useEffect, useRef, useState } from 'react';

import { Icon } from '@/components/icon';
import { Markdown } from '@/components/markdown';
import { useWallet } from '@/components/wallet-provider';
import { ApiError, api } from '@/lib/api';
import type { LotteryCampaign, LotteryDraw, LotteryPrize } from '@/types';

const SPIN_MS = 4200;
const WHEEL_SIZE = 300;

function shortName(name: string): string {
  return name.length > 6 ? `${name.slice(0, 6)}…` : name;
}

function drawTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function segmentPath(index: number, count: number, radius: number): string {
  const start = (index / count) * 2 * Math.PI - Math.PI / 2;
  const end = ((index + 1) / count) * 2 * Math.PI - Math.PI / 2;
  const x1 = radius + radius * Math.cos(start);
  const y1 = radius + radius * Math.sin(start);
  const x2 = radius + radius * Math.cos(end);
  const y2 = radius + radius * Math.sin(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M${radius},${radius} L${x1},${y1} A${radius},${radius} 0 ${large} 1 ${x2},${y2} Z`;
}

function Wheel({ prizes, rotation, highlight }: { prizes: LotteryPrize[]; rotation: number; highlight: number | null }) {
  const radius = WHEEL_SIZE / 2;
  const count = prizes.length;
  return (
    <div className="lottery-wheel" aria-hidden="true">
      <span className="lottery-pointer" />
      <svg
        viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}
        style={{ transform: `rotate(${rotation}deg)`, transitionDuration: `${SPIN_MS}ms` }}
      >
        {count === 0 ? (
          <circle cx={radius} cy={radius} r={radius} className="lottery-seg is-even" />
        ) : count === 1 ? (
          <circle cx={radius} cy={radius} r={radius} className={`lottery-seg is-odd${highlight === prizes[0].id ? ' is-hit' : ''}`} />
        ) : (
          prizes.map((prize, index) => (
            <path
              key={prize.id}
              d={segmentPath(index, count, radius)}
              className={`lottery-seg ${index % 2 ? 'is-even' : 'is-odd'}${highlight === prize.id ? ' is-hit' : ''}`}
            />
          ))
        )}
        {prizes.map((prize, index) => {
          const angle = ((index + 0.5) / Math.max(count, 1)) * 360;
          return (
            <text
              key={prize.id}
              x={radius}
              y={radius * 0.32}
              className={`lottery-label${prize.chance === 0 ? ' is-out' : ''}`}
              transform={`rotate(${angle} ${radius} ${radius})`}
            >
              {shortName(prize.name)}
            </text>
          );
        })}
        <circle cx={radius} cy={radius} r={radius * 0.17} className="lottery-hub" />
      </svg>
    </div>
  );
}

export function LotteryClient() {
  const { user, status, connect, logout } = useWallet();
  const [campaign, setCampaign] = useState<LotteryCampaign | null>(null);
  const [mine, setMine] = useState<LotteryDraw[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [result, setResult] = useState<LotteryDraw | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    api.lottery(controller.signal)
      .then((data) => { if (active) setCampaign(data.campaign); })
      .catch((cause) => {
        if (active && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : '抽奖加载失败');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [version]);

  useEffect(() => {
    if (!user?.address) {
      setMine(null);
      return;
    }
    const controller = new AbortController();
    let active = true;
    api.lotteryMine(controller.signal)
      .then((data) => { if (active) setMine(data.draws); })
      .catch((cause) => {
        if (!active || controller.signal.aborted) return;
        if (cause instanceof ApiError && cause.status === 401) logout();
      });
    return () => { active = false; controller.abort(); };
  }, [user?.address, version, logout]);

  async function draw() {
    if (!campaign || spinning) return;
    setSpinning(true);
    setError('');
    setResult(null);
    setHighlight(null);
    try {
      const data = await api.drawLottery();
      const index = Math.max(0, campaign.prizes.findIndex((prize) => prize.id === data.prize_id));
      const count = Math.max(campaign.prizes.length, 1);
      const center = ((index + 0.5) / count) * 360;
      setRotation((current) => {
        const base = current - (current % 360);
        return base + 360 * 5 + ((360 - center) % 360);
      });
      timer.current = window.setTimeout(() => {
        setHighlight(data.prize_id);
        setResult(data);
        setSpinning(false);
        setVersion((value) => value + 1);
      }, SPIN_MS + 150);
    } catch (cause) {
      setSpinning(false);
      if (cause instanceof ApiError && cause.status === 401) logout();
      setError(cause instanceof Error ? cause.message : '抽奖失败，请稍后重试');
      setVersion((value) => value + 1);
    }
  }

  if (loading) {
    return <div className="card loading-card"><div className="skeleton" /><div className="skeleton" /></div>;
  }
  if (!campaign) {
    return (
      <div className="card empty-state">
        <div className="empty-art"><Icon name="gift" size={30} /></div>
        <h2>暂无抽奖</h2>
      </div>
    );
  }

  const empty = campaign.prizes.every((prize) => prize.chance === 0);

  let action;
  if (!campaign.is_open) {
    action = <button className="btn btn-primary" disabled>抽奖暂未开放</button>;
  } else if (!user) {
    action = (
      <button className="btn btn-primary" disabled={status === 'connecting' || status === 'loading'} onClick={() => void connect()}>
        <Icon name="wallet" size={16} />
        {status === 'connecting' ? '等待签名确认…' : '连接钱包'}
      </button>
    );
  } else {
    action = (
      <button className="btn btn-primary" disabled={spinning || empty} onClick={() => void draw()}>
        <Icon name="gift" size={16} />
        {spinning ? '抽奖中…' : '抽一次'}
      </button>
    );
  }

  return (
    <div className="lottery-layout">
      <section className="card lottery-stage">
        <Wheel prizes={campaign.prizes} rotation={rotation} highlight={highlight} />
        <div className="lottery-action">{action}</div>
        {result && (
          <div className="success-notice lottery-result" role="status">
            <Icon name="gift" size={18} />
            <b>{result.prize_name}</b>
          </div>
        )}
        {error && <div className="inline-notice" role="alert">{error}</div>}
      </section>

      <div className="lottery-side">
        <section className="card lottery-panel">
          <h2>{campaign.title}</h2>
          {campaign.description && <Markdown source={campaign.description} className="lottery-description" />}
        </section>

        <section className="card lottery-panel">
          <h3>奖品</h3>
          {campaign.prizes.length ? (
            <ul className="lottery-prizes">
              {campaign.prizes.map((prize) => (
                <li key={prize.id} className={prize.chance === 0 ? 'is-out' : ''}>
                  <span className="lottery-prize-name">{prize.name}</span>
                  <span className="lottery-prize-chance">{prize.chance}%</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {user && mine && mine.length > 0 && (
          <section className="card lottery-panel">
            <h3>我的记录</h3>
            <ul className="lottery-records">
              {mine.map((item) => (
                <li key={item.id}>
                  <span>{item.prize_name}</span>
                  <small>{drawTime(item.created_at)}</small>
                  {item.delivered && <span className="event-state event-state-ended">已发放</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
