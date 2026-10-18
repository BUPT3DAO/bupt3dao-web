'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@/components/wallet-provider';
import { ApiError, api } from '@/lib/api';
import { explainCampusError, type EnabledGame } from '@/lib/campus-chain';
import { isMobileVisitor, type LandmarkId } from '@/lib/campus-scene';
import { CampusMapView } from './campus/map-view';
import { CampusControlPanel } from './campus/control-panel';
import { useCampusSession } from './campus/use-campus-session';
import type { GameConfig, UserPublic } from '@/types';

function CampusSession({
  config,
  user,
  readOnly,
  invalidate,
}: {
  config: EnabledGame;
  user: UserPublic;
  readOnly: boolean;
  invalidate: (cause: unknown) => void;
}) {
  const [selected, setSelected] = useState<LandmarkId>('sculpture');
  const [focusVersion, setFocusVersion] = useState(0);
  const select = useCallback((id: LandmarkId) => {
    setSelected(id);
    setFocusVersion((n) => n + 1);
  }, []);
  const { connect } = useWallet();
  const session = useCampusSession(
    config,
    user.address as `0x${string}`,
    readOnly,
    invalidate,
  );
  return (
    <div className="campus-session campus-v2">
      <div className="campus-topline">
        <span>BASE SEPOLIA · 测试网</span>
        <div>
          <span className="campus-online-dot" />
          {readOnly
            ? '校园浏览'
            : session.wallet.address?.toLowerCase() ===
                user.address.toLowerCase()
              ? '钱包已连接'
              : '连接钱包即可建设'}
        </div>
      </div>
      <div className="campus-dashboard">
        <div className="campus-map-wrap">
          <div className="campus-map-refresh">
            <span>每一分钟同步链上状态</span>
            <button
              className="text-link"
              disabled={session.loading}
              onClick={session.refresh}
            >
              刷新链上状态 ↻
            </button>
          </div>
          <CampusMapView
            player={session.snapshot?.player ?? null}
            completedRounds={
              session.snapshot ? session.snapshot.world.round - 1n : 0n
            }
            selected={selected}
            onSelect={select}
            focusVersion={focusVersion}
            effect={session.effect}
          />
        </div>
        <CampusControlPanel
          session={session}
          selected={selected}
          onSelect={select}
          readOnly={readOnly}
          address={user.address}
          nickname={user.nickname}
          config={config}
          connect={connect}
        />
      </div>
    </div>
  );
}
export function CampusClient() {
  const { user, status, connect, logout } = useWallet();
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [readOnly, setReadOnly] = useState(true);
  const invalidate = useCallback(
    (cause: unknown) => {
      setConfig(null);
      setError(explainCampusError(cause));
      if (
        cause instanceof ApiError &&
        (cause.status === 401 || cause.status === 403)
      )
        logout();
      else if (
        cause instanceof Error &&
        /钱包已切换|登录状态已变化/.test(cause.message)
      )
        logout();
    },
    [logout],
  );
  useEffect(() => {
    const coarse = matchMedia('(pointer: coarse)');
    const sync = () =>
      setReadOnly(
        isMobileVisitor(
          window.innerWidth,
          navigator.userAgent,
          coarse.matches,
          navigator.maxTouchPoints,
        ),
      );
    sync();
    window.addEventListener('resize', sync);
    coarse.addEventListener('change', sync);
    return () => {
      window.removeEventListener('resize', sync);
      coarse.removeEventListener('change', sync);
    };
  }, []);
  useEffect(() => {
    setConfig(null);
    setError('');
    if (!user) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    api
      .gameConfig(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setConfig(next);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) invalidate(cause);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [user, invalidate]);
  return (
    <div className="campus-page campus-play">
      <div className="campus-play-heading">
        <div>
          <span className="eyebrow">YOUR ONCHAIN CAMPUS / CHAPTER 02</span>
          <h1>
            一座校园，慢慢生长<span className="heading-dot">.</span>
          </h1>
          <p>在熟悉的地标间探索，用每次建设，让邮园更明亮。</p>
        </div>
        <Link className="text-link" href="/game/learn">
          玩法与地图指南 →
        </Link>
      </div>
      {status === 'loading' || loading ? (
        <div className="card campus-gate" role="status">
          正在确认成员身份与游戏状态…
        </div>
      ) : error ? (
        <div className="card campus-gate" role="alert">
          <h2>暂时无法进入校园</h2>
          <p>{error}</p>
          <button
            className="btn btn-ghost"
            onClick={() => window.location.reload()}
          >
            重新检查
          </button>
          <Link href="/game#preview" className="text-link">
            查看公开校园预览
          </Link>
        </div>
      ) : !user ? (
        <div className="card campus-gate">
          <h2>{readOnly ? '在手机上探索微缩校园' : '连接钱包后进入校园'}</h2>
          <p>
            {readOnly
              ? '公开预览无需钱包。查看个人进度需要有效的社区登录态，完整建设请使用电脑浏览器。'
              : '首次登录自动创建社区账号。你的通行证、建筑和建设记录跟随钱包地址。'}
          </p>
          {!readOnly && (
            <button
              className="btn btn-primary"
              disabled={status === 'connecting'}
              onClick={() => void connect()}
            >
              {status === 'connecting' ? '等待签名…' : '连接钱包'}
            </button>
          )}
          <Link href="/game#preview" className="btn btn-ghost">
            查看公开校园预览
          </Link>
        </div>
      ) : !config?.enabled || !config.contract_address ? (
        <div className="card campus-gate">
          <h2>校园暂未开放</h2>
          <p>当前未启用游戏配置，已有链上进度仍保留。</p>
          <Link href="/game/learn" className="btn btn-ghost">
            阅读指南
          </Link>
        </div>
      ) : (
        <CampusSession
          key={`${user.address}:${config.chain_id}:${config.contract_address}`}
          config={config as EnabledGame}
          user={user}
          readOnly={readOnly}
          invalidate={invalidate}
        />
      )}
    </div>
  );
}
