'use client';
import Link from 'next/link';
import { useState } from 'react';
import { formatEther } from 'viem';
import { BADGES, contractUrl, transactionUrl } from '@/lib/campus';
import {
  isBusy,
  JOURNEY,
  LANDMARKS,
  type LandmarkId,
} from '@/lib/campus-scene';
import type { EnabledGame } from '@/lib/campus-chain';
import type { useCampusSession } from './use-campus-session';

export function CampusControlPanel({
  session,
  selected,
  onSelect,
  readOnly,
  address,
  nickname,
  config,
  connect,
}: {
  session: ReturnType<typeof useCampusSession>;
  selected: LandmarkId;
  onSelect: (id: LandmarkId) => void;
  readOnly: boolean;
  address: string;
  nickname: string | null;
  config: EnabledGame;
  connect: () => Promise<void>;
}) {
  const [contribution, setContribution] = useState('10');
  const { snapshot, loading, error, phase, wallet, hash } = session;
  const player = snapshot?.player,
    world = snapshot?.world;
  const walletMatches = wallet.address?.toLowerCase() === address.toLowerCase();
  const disabled =
    readOnly ||
    loading ||
    !snapshot ||
    !walletMatches ||
    !!world?.stopped ||
    isBusy(phase) ||
    !!hash;
  const level =
    selected === 'main'
      ? (player?.mainLevel ?? 1)
      : (player?.libraryLevel ?? 1);
  const cost = 50n * BigInt(level) * BigInt(level);
  const amount = /^\d{1,78}$/.test(contribution) ? BigInt(contribution) : 0n;
  const remaining = world ? world.goal - world.progress : 0n;
  const progressPercent =
    world && world.goal > 0n ? Number((world.progress * 100n) / world.goal) : 0;
  const resourceShortfall =
    !!player && (player.knowledge < cost || player.compute < cost);
  const canContribute =
    !!player &&
    amount > 0n &&
    amount <= remaining &&
    amount <= player.knowledge &&
    amount <= player.compute;
  const txMessages: Partial<Record<typeof phase, string>> = {
    wallet: '请在钱包中确认这次操作。',
    submitted: '交易已提交，正在等待链上确认…',
    syncing: '交易已成功，正在同步校园进度…',
    success: '交易与校园进度已同步。',
    cancelled: '交易已取消。',
    timeout: '交易查询或进度同步待恢复。',
  };
  const landmark = LANDMARKS.find((l) => l.id === selected)!;
  return (
    <aside className="campus-control" aria-label="校园进度与操作">
      <div className="campus-control-intro">
        <span className="eyebrow">YOUR CAMPUS</span>
        <h2>我的链上邮园</h2>
        <p>{nickname || `${address.slice(0, 6)}…${address.slice(-4)}`}</p>
      </div>
      {readOnly && (
        <p className="campus-readonly-note">
          手机浏览模式 · 可查看地图与个人进度，请在电脑上完成领取、升级和共建。
        </p>
      )}
      {loading && !snapshot && <p role="status">正在读取链上校园…</p>}
      {error && (
        <div role="alert" className="inline-notice">
          {error}
          {hash ? (
            <button
              className="text-link"
              disabled={isBusy(phase)}
              onClick={() => void session.retry()}
            >
              重试查询与同步
            </button>
          ) : (
            <button className="text-link" onClick={session.refresh}>
              刷新状态
            </button>
          )}
        </div>
      )}
      {snapshot && player && world && (
        <>
          <div className="campus-balance-label">
            可用资源 <small>含待结算</small>
          </div>
          <div className="campus-resources">
            <div>
              <span>知识</span>
              <strong data-testid="campus-knowledge">
                {player.knowledge.toString()}
              </strong>
              <small>图书馆 · 每小时 +{player.libraryLevel * 10}</small>
            </div>
            <div>
              <span>算力</span>
              <strong>{player.compute.toString()}</strong>
              <small>主楼 · 每小时 +{player.mainLevel * 10}</small>
            </div>
          </div>
          <p className="campus-gas">
            测试币余额：{Number(formatEther(snapshot.gas)).toFixed(5)} ETH
            {!readOnly && snapshot.gas === 0n && config.faucet_url && (
              <>
                {' '}
                ·{' '}
                <a
                  className="text-link"
                  href={config.faucet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  领取测试币 ↗
                </a>
              </>
            )}
          </p>
          {!readOnly && !walletMatches && (
            <div className="campus-wallet-hint">
              <p>连接与登录账号相同的钱包后即可建设。</p>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => void connect()}
              >
                连接当前钱包
              </button>
            </div>
          )}
          {!readOnly && walletMatches && wallet.chain !== config.chain_id && (
            <p className="campus-wallet-hint">
              当前网络不匹配，操作时将请求钱包切换到 Base Sepolia。
            </p>
          )}
          {world.stopped && (
            <p className="inline-notice">链上操作已暂停，现有进度仍可查看。</p>
          )}
          <section className="campus-action-card">
            <span className="eyebrow">SELECTED LOCATION</span>
            <h3>{landmark.title}</h3>
            {!player.joined ? (
              <>
                <p>
                  领取不可转让的共建者通行证，获得知识和算力各 60 点，开始建设。
                </p>
                {!readOnly && (
                  <button
                    className="btn btn-primary"
                    disabled={disabled}
                    onClick={() => void session.transact({ kind: 'join' })}
                  >
                    领取通行证
                  </button>
                )}
              </>
            ) : selected === 'main' || selected === 'library' ? (
              <>
                <p>
                  {selected === 'main' ? '主楼产出算力。' : '图书馆产出知识。'}
                  当前 {level} 级，最高 5 级。
                </p>
                <p>升级会自动结算收益，无需先领取资源。</p>
                {level < 5 ? (
                  <>
                    <p className="campus-cost">
                      下次升级：知识与算力各 {cost.toString()} 点
                    </p>
                    {resourceShortfall && (
                      <small>资源暂不足，等待建筑继续产出后再来。</small>
                    )}
                    {!readOnly && (
                      <button
                        className="btn btn-primary"
                        disabled={disabled || resourceShortfall}
                        onClick={() =>
                          void session.transact({
                            kind: 'upgrade',
                            building: selected === 'main' ? 0 : 1,
                          })
                        }
                      >
                        升级到 {level + 1} 级
                      </button>
                    )}
                  </>
                ) : (
                  <p className="campus-cost">建筑与附属设施已全部建成。</p>
                )}
              </>
            ) : selected === 'plaza' ? (
              <>
                <p>
                  第 {world.round.toString()} 轮「点亮邮园」 ·
                  所有成员共享进度。
                </p>
                <div
                  className="campus-progress"
                  role="progressbar"
                  aria-label="本轮公共建设进度"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${progressPercent}%` }} />
                </div>
                <p>
                  {world.progress.toString()} / {world.goal.toString()} 点
                </p>
                <p>贡献会自动结算收益，每次等量投入两种资源。</p>
                {!readOnly && (
                  <>
                    <label className="campus-input-label">
                      各投入多少知识和算力
                      <input
                        type="number"
                        min="1"
                        max={remaining.toString()}
                        step="1"
                        value={contribution}
                        onChange={(e) => setContribution(e.target.value)}
                      />
                    </label>
                    {!canContribute && (
                      <small>
                        请输入资源余额以内、且不超过本轮剩余{' '}
                        {remaining.toString()} 点的正整数。
                      </small>
                    )}
                    <button
                      className="btn btn-primary"
                      disabled={disabled || !canContribute}
                      onClick={() =>
                        void session.transact({ kind: 'contribute', amount })
                      }
                    >
                      确认贡献
                    </button>
                  </>
                )}
                <small>
                  累计贡献：{player.contributed.toString()} 点 ·
                  共建景观按已完成轮次展示。
                </small>
              </>
            ) : selected === 'sculpture' ? (
              <>
                <p>
                  园路中的大龙邮票浮雕，连接邮政记忆与链上身份。共建者通行证绑定当前钱包，无法转让。
                </p>
                <div className="campus-passport">
                  <span>POST CAMPUS</span>
                  <strong>共建者 #{address.slice(2, 8).toUpperCase()}</strong>
                  <small>
                    主楼 Lv.{player.mainLevel} · 图书馆 Lv.{player.libraryLevel}
                  </small>
                </div>
              </>
            ) : (
              <>
                <p>
                  了解收益、交易手续费和公共建设规则，在校园里完成第一段链上旅程。
                </p>
                <Link className="btn btn-ghost" href="/game/learn">
                  打开玩法指南 →
                </Link>
              </>
            )}
            {landmark.artistic && <small>艺术化场景，非实景一比一复刻。</small>}
          </section>
          {player.joined && (
            <div className="campus-collect">
              <span>
                余额中待结算：知识 {snapshot.pending[0].toString()} · 算力{' '}
                {snapshot.pending[1].toString()}
              </span>
              {!readOnly && (
                <button
                  className="text-link"
                  disabled={disabled || snapshot.pending.every((n) => n === 0n)}
                  onClick={() => void session.transact({ kind: 'collect' })}
                >
                  领取资源
                </button>
              )}
            </div>
          )}
          <section className="campus-steps">
            <span className="eyebrow">FIRST JOURNEY</span>
            <h3>下一站，走向链上。</h3>
            {JOURNEY.map((step) => {
              const done = !!(player.badges & step.bit);
              return (
                <button
                  type="button"
                  className={`campus-journey-step ${done ? 'done' : ''}`}
                  key={step.bit}
                  onClick={() => onSelect(step.landmark)}
                >
                  <span>{done ? '✓' : '→'}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <small>
                      {done ? '已完成 · 查看对应地标' : step.explanation}
                    </small>
                  </div>
                </button>
              );
            })}
          </section>
          <section className="campus-badges">
            <span className="eyebrow">ACHIEVEMENTS</span>
            <h3>共建成就</h3>
            <div>
              {BADGES.map((b) => (
                <span
                  key={b.bit}
                  className={player.badges & b.bit ? 'earned' : ''}
                  title={b.description}
                >
                  {b.label}
                </span>
              ))}
            </div>
          </section>
        </>
      )}
      {txMessages[phase] && (
        <div className="campus-tx" role="status">
          {txMessages[phase]}
          {session.lastHash && (
            <a
              href={transactionUrl(config, session.lastHash) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              查看交易 ↗
            </a>
          )}
        </div>
      )}
      <div className="campus-control-foot">
        <a
          className="text-link"
          href={contractUrl(config) ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
        >
          查看游戏合约 ↗
        </a>
        <Link className="text-link" href="/game/learn">
          玩法与交易说明 →
        </Link>
      </div>
    </aside>
  );
}
