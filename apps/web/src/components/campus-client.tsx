'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { createPublicClient, formatEther, http } from 'viem';
import { baseSepolia, foundry } from 'viem/chains';

import { Icon } from '@/components/icon';
import { useWallet } from '@/components/wallet-provider';
import { ApiError, api } from '@/lib/api';
import {
  BADGES, CAMPUS_ABI, contractUrl, transactionUrl,
  type CampusPlayer, type CampusWorld,
} from '@/lib/campus';
import type { GameConfig, UserPublic } from '@/types';

type Location = 'main' | 'library' | 'plaza' | 'sculpture' | 'lab';
type Move = { kind: 'join' } | { kind: 'collect' } | { kind: 'upgrade'; building: 0 | 1 } | { kind: 'contribute'; amount: bigint };
type Snapshot = { player: CampusPlayer; world: CampusWorld; pending: [bigint, bigint]; gas: bigint };

const LOCATIONS: Array<{ id: Location; title: string; subtitle: string; x: string; y: string }> = [
  { id: 'library', title: '沙河图书馆', subtitle: '知识', x: '22%', y: '27%' },
  { id: 'main', title: '西土城主楼', subtitle: '算力', x: '74%', y: '28%' },
  { id: 'plaza', title: '时光广场', subtitle: '共建', x: '50%', y: '61%' },
  { id: 'sculpture', title: '大龙邮票石雕', subtitle: '通行证', x: '18%', y: '78%' },
  { id: 'lab', title: '链协实验室', subtitle: '学习', x: '81%', y: '75%' },
];

function makeClient(config: GameConfig) {
  return createPublicClient({
    chain: config.chain_id === 31337 ? foundry : baseSepolia,
    transport: http(config.rpc_url, { timeout: 12_000 }),
  });
}

function playerField(raw: unknown, name: string, index: number): unknown {
  return Array.isArray(raw) ? raw[index] : (raw as Record<string, unknown>)[name];
}

function decodePlayer(raw: unknown): CampusPlayer {
  return {
    knowledge: BigInt(playerField(raw, 'knowledge', 0) as bigint),
    compute: BigInt(playerField(raw, 'compute', 1) as bigint),
    contributed: BigInt(playerField(raw, 'contributed', 5) as bigint),
    mainLevel: Number(playerField(raw, 'mainLevel', 6)),
    libraryLevel: Number(playerField(raw, 'libraryLevel', 7)),
    badges: Number(playerField(raw, 'badges', 8)),
    joined: Boolean(playerField(raw, 'joined', 9)),
  };
}

function explainError(cause: unknown): string {
  if (cause instanceof Error) {
    const error = cause as Error & { code?: number; shortMessage?: string };
    if (error.code === 4001 || error.name === 'UserRejectedRequestError') return '已在钱包中取消操作。';
    if (error.message.includes('InsufficientResources')) return '知识或算力不足，请等待产出。';
    if (error.message.includes('InvalidContribution')) return '公共项目进度已变化，请刷新后重新输入贡献量。';
    if (error.message.includes('insufficient funds')) return '测试币不足，请先领取 Base Sepolia 测试 ETH。';
    return error.shortMessage ?? error.message;
  }
  return '操作未完成，请稍后重试。';
}

function Structure({ kind }: { kind: Location }) {
  return (
    <svg className={`campus-structure campus-structure-${kind}`} viewBox="0 0 180 132" aria-hidden="true">
      <ellipse cx="90" cy="114" rx="75" ry="14" fill="rgba(22,24,65,.25)" />
      <path d="M23 81 89 45 159 81 91 119Z" fill="var(--tile-ground)" />
      {kind === 'plaza' ? <>
        <path d="M41 79 91 53 140 79 91 105Z" fill="#d1c4a7" />
        <path d="M91 65v27" stroke="#fff7db" strokeWidth="4" />
        <circle cx="91" cy="61" r="12" fill="var(--roof)" />
        <path d="m34 74 15-8 15 8-15 8Z" fill="#7aaa83" />
        <path d="m121 80 14-8 14 8-14 8Z" fill="#7aaa83" />
      </> : kind === 'sculpture' ? <>
        <path d="M66 88 91 74 116 88 91 102Z" fill="#e9d5aa" />
        <path d="M79 44 93 36 104 55 103 82 88 90 77 82Z" fill="var(--wall)" />
        <path d="m79 44 14-8 4 25-10 7Z" fill="var(--roof)" />
        <circle cx="98" cy="36" r="8" fill="#f1c56e" />
      </> : <>
        <path d="M44 54 91 29 139 54 139 91 91 117 44 91Z" fill="var(--wall)" />
        <path d="M44 54 91 29 139 54 91 81Z" fill="var(--roof)" />
        <path d="M44 54 91 81 91 117 44 91Z" fill="var(--side)" />
        <path d="M56 69 67 75v18L56 87Z M72 78l11 6v18l-11-6Z" fill="var(--window)" />
        <path d="m100 84 12-7v18l-12 7Z m19-11 11-6v18l-11 7Z" fill="var(--window)" />
        {kind === 'library' && <path d="M60 43 91 26 121 43 91 60Z" fill="#f8e6c1" />}
        {kind === 'lab' && <path d="M87 29V12m-9 8h18" stroke="#d5eeff" strokeWidth="4" />}
        {kind === 'main' && <path d="M91 29V12m-12 0h24" stroke="#fbe3a0" strokeWidth="4" />}
      </>}
    </svg>
  );
}

function CampusMap({ selected, onSelect, player, completedRounds }: {
  selected: Location;
  onSelect: (location: Location) => void;
  player: CampusPlayer | null;
  completedRounds: bigint;
}) {
  return (
    <div className={`campus-map ${completedRounds > 0n ? 'campus-map-lit' : ''}`} aria-label="链上邮园地图">
      <span className="campus-map-sun" aria-hidden="true" />
      <svg className="campus-map-paths" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
        <path d="M210 185Q330 280 490 395T755 195 M495 390Q405 455 205 505 M495 390Q640 515 825 480" fill="none" stroke="#e4d9bd" strokeWidth="36" strokeLinecap="round" />
        <path d="M210 185Q330 280 490 395T755 195 M495 390Q405 455 205 505 M495 390Q640 515 825 480" fill="none" stroke="#f6eedb" strokeWidth="27" strokeLinecap="round" strokeDasharray="6 22" />
      </svg>
      <span className="campus-map-mark mark-one" aria-hidden="true">✦</span>
      <span className="campus-map-mark mark-two" aria-hidden="true">✦</span>
      <span className="campus-map-mark mark-three" aria-hidden="true">✧</span>
      {completedRounds > 0n && <span className="campus-map-beacon" aria-hidden="true">✦</span>}
      {LOCATIONS.map((location) => (
        <button
          key={location.id}
          className={`campus-location campus-location-${location.id} ${selected === location.id ? 'selected' : ''}`}
          style={{ left: location.x, top: location.y }}
          onClick={() => onSelect(location.id)}
          aria-pressed={selected === location.id}
          aria-label={`${location.title}，${location.subtitle}`}
        >
          <Structure kind={location.id} />
          <span className="campus-location-name">{location.title}<small>{location.id === 'main' ? `Lv.${player?.mainLevel ?? 1}` : location.id === 'library' ? `Lv.${player?.libraryLevel ?? 1}` : location.id === 'plaza' ? `已完成 ${completedRounds} 轮` : location.subtitle}</small></span>
        </button>
      ))}
      <span className="campus-map-label">BUPT3DAO · 校园共建计划</span>
    </div>
  );
}

function CampusSession({ config, user }: { config: GameConfig & { contract_address: `0x${string}` }; user: UserPublic }) {
  const [selected, setSelected] = useState<Location>('sculpture');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletChain, setWalletChain] = useState<number | null>(null);
  const [pendingHash, setPendingHash] = useState<`0x${string}` | null>(null);
  const [pendingLabel, setPendingLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [contribution, setContribution] = useState('10');
  const { connect } = useWallet();
  const account = user.address as `0x${string}`;
  const pendingKey = `bupt3dao.campus.pending.${config.chain_id}.${config.contract_address}.${user.address}`;
  const walletMatches = walletAddress?.toLowerCase() === user.address.toLowerCase();

  useEffect(() => {
    let active = true;
    let unwatch: () => void = () => {};
    void Promise.all([import('@/components/web3-providers'), import('wagmi/actions')]).then(([wallet, actions]) => {
      if (!active) return;
      const sync = (address: string | undefined, chainId: number | undefined) => {
        setWalletAddress(address ?? null);
        setWalletChain(chainId ?? null);
      };
      const current = actions.getAccount(wallet.config);
      sync(current.address, current.chainId);
      unwatch = actions.watchAccount(wallet.config, {
        onChange: (next) => sync(next.address, next.chainId),
      });
    }).catch(() => { if (active) setWalletAddress(null); });
    return () => { active = false; unwatch(); };
  }, []);

  useEffect(() => {
    let active = true;
    const client = makeClient(config);
    setLoading(true);
    setLoadError('');
    void Promise.all([
      client.readContract({ address: config.contract_address, abi: CAMPUS_ABI, functionName: 'getPlayer', args: [account] }),
      client.readContract({ address: config.contract_address, abi: CAMPUS_ABI, functionName: 'getWorld' }),
      client.readContract({ address: config.contract_address, abi: CAMPUS_ABI, functionName: 'getPending', args: [account] }),
      client.getBalance({ address: account }),
    ]).then(([rawPlayer, world, pending, gas]) => {
      if (!active) return;
      setSnapshot({
        player: decodePlayer(rawPlayer),
        world: { round: world[0], goal: world[1], progress: world[2], stopped: world[3] },
        pending: [pending[0], pending[1]],
        gas,
      });
    }).catch((cause) => {
      if (active) { setSnapshot(null); setLoadError(`链上数据暂时无法读取：${explainError(cause)}`); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [config, account, refreshVersion]);

  useEffect(() => {
    const id = window.setInterval(() => setRefreshVersion((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const waitForReceipt = useCallback(async (initialHash: `0x${string}`) => {
    const client = makeClient(config);
    const receipt = await client.waitForTransactionReceipt({
      hash: initialHash,
      onReplaced: ({ transaction }) => {
        const nextHash = transaction.hash;
        window.localStorage.setItem(pendingKey, nextHash);
        setPendingHash(nextHash);
      },
    });
    if (receipt.status !== 'success') {
      window.localStorage.removeItem(pendingKey);
      setPendingHash(null);
      throw new Error('交易已上链，但合约执行失败。请查看交易详情。');
    }
    window.localStorage.removeItem(pendingKey);
    setPendingHash(null);
    setPendingLabel('');
    setRefreshVersion((n) => n + 1);
  }, [config, pendingKey]);

  useEffect(() => {
    const saved = window.localStorage.getItem(pendingKey);
    if (!saved || !/^0x[0-9a-fA-F]{64}$/.test(saved)) return;
    const hash = saved as `0x${string}`;
    setPendingHash(hash);
    setPendingLabel('恢复上一笔交易');
    setBusy(true);
    void waitForReceipt(hash).catch((cause) => setActionError(explainError(cause))).finally(() => setBusy(false));
  }, [pendingKey, waitForReceipt]);

  const transact = useCallback(async (move: Move, label: string) => {
    if (busy || pendingHash || !walletMatches || snapshot?.world.stopped) return;
    setBusy(true);
    setActionError('');
    setPendingLabel(label);
    try {
      const [wallet, actions] = await Promise.all([
        import('@/components/web3-providers'), import('wagmi/actions'),
      ]);
      const connected = actions.getAccount(wallet.config);
      if (connected.address?.toLowerCase() !== user.address.toLowerCase()) throw new Error('钱包地址与登录成员不一致，请重新连接钱包。');
      const chainId = config.chain_id as 1 | 84532 | 31337;
      if (connected.chainId !== chainId) await actions.switchChain(wallet.config, { chainId });
      if ((await makeClient(config).getBalance({ address: account })) === 0n) throw new Error('insufficient funds');
      const common = { address: config.contract_address, abi: CAMPUS_ABI, chainId } as const;
      let hash: `0x${string}`;
      if (move.kind === 'join') hash = await actions.writeContract(wallet.config, { ...common, functionName: 'join' });
      else if (move.kind === 'collect') hash = await actions.writeContract(wallet.config, { ...common, functionName: 'collect' });
      else if (move.kind === 'upgrade') hash = await actions.writeContract(wallet.config, { ...common, functionName: 'upgrade', args: [move.building] });
      else hash = await actions.writeContract(wallet.config, { ...common, functionName: 'contribute', args: [move.amount] });
      window.localStorage.setItem(pendingKey, hash);
      setPendingHash(hash);
      await waitForReceipt(hash);
    } catch (cause) {
      setActionError(explainError(cause));
    } finally {
      setBusy(false);
    }
  }, [account, busy, config, pendingHash, pendingKey, snapshot?.world.stopped, user.address, waitForReceipt, walletMatches]);

  const player = snapshot?.player ?? null;
  const world = snapshot?.world ?? null;
  const remaining = world ? world.goal - world.progress : 0n;
  const contributionAmount = /^\d+$/.test(contribution) ? BigInt(contribution) : 0n;
  const canContribute = !!player?.joined && contributionAmount > 0n && contributionAmount <= remaining
    && player.knowledge >= contributionAmount && player.compute >= contributionAmount;
  const level = selected === 'main' ? player?.mainLevel ?? 1 : player?.libraryLevel ?? 1;
  const upgradeCost = 50n * BigInt(level) * BigInt(level);
  const canUpgrade = !!player?.joined && level < 5 && player.knowledge >= upgradeCost && player.compute >= upgradeCost;
  const actionDisabled = busy || !!pendingHash || !walletMatches || !!world?.stopped;
  const explorerContract = contractUrl(config);

  return (
    <div className="campus-session">
      <div className="campus-topline">
        <span>BASE SEPOLIA · {config.chain_id === 31337 ? '本地链' : '测试网'}</span>
        <div><span className="campus-online-dot" />{walletMatches ? (walletChain === config.chain_id ? '钱包已连接' : '请切换网络') : '请连接当前钱包'}</div>
      </div>
      <div className="campus-dashboard">
        <section className="campus-map-wrap">
          <div className="campus-map-toolbar"><span>POST CAMPUS / MAP 01</span><button className="text-link" onClick={() => setRefreshVersion((n) => n + 1)} disabled={loading}>刷新链上状态 ↻</button></div>
          <CampusMap selected={selected} onSelect={setSelected} player={player} completedRounds={world ? world.round - 1n : 0n} />
          <p className="campus-map-caption">融合西土城与沙河代表地标的创作地图 · 点击建筑查看玩法</p>
        </section>
        <aside className="campus-control">
          <div className="campus-control-intro"><span className="eyebrow">YOUR CAMPUS</span><h2>我的链上邮园</h2><p>{user.nickname || `${user.address.slice(0, 6)}…${user.address.slice(-4)}`}</p></div>
          {loading && !snapshot ? <div className="campus-data-state" role="status">正在读取链上校园…</div> : loadError ? <div className="inline-notice" role="alert">{loadError}<button className="text-link" onClick={() => setRefreshVersion((n) => n + 1)}>重试</button></div> : null}
          {snapshot && <>
            <div className="campus-resources"><div><span>知识</span><strong>{player?.knowledge.toString() ?? '0'}</strong><small>沙河图书馆 · 每小时 +{(player?.libraryLevel ?? 1) * 10}</small></div><div><span>算力</span><strong>{player?.compute.toString() ?? '0'}</strong><small>西土城主楼 · 每小时 +{(player?.mainLevel ?? 1) * 10}</small></div></div>
            <p className="campus-gas">测试币余额：{Number(formatEther(snapshot.gas)).toFixed(5)} ETH {snapshot.gas === 0n && config.faucet_url && <a href={config.faucet_url} target="_blank" rel="noopener noreferrer" className="text-link">领取测试币 ↗</a>}</p>
            {!walletMatches && <div className="campus-wallet-hint"><p>请连接与登录账号相同的钱包，才能提交游戏交易。</p><button className="btn btn-ghost btn-sm" onClick={() => void connect()}>连接当前钱包</button></div>}
            {walletMatches && walletChain !== config.chain_id && <p className="campus-wallet-hint">当前网络与校园测试网不同。点击游戏操作时会先请求钱包切换网络。</p>}
            {world?.stopped && <div className="inline-notice">链上操作已暂时暂停，现有进度仍可查看。</div>}
            <div className="campus-action-card">
              <span className="eyebrow">SELECTED LOCATION</span>
              <h3>{LOCATIONS.find((item) => item.id === selected)?.title}</h3>
            {!player?.joined ? <><p>领取一张不可转让的共建者通行证，获得知识和算力各 60 点，然后开始建设。</p><button className="btn btn-primary" disabled={actionDisabled} onClick={() => void transact({ kind: 'join' }, '领取通行证')}>领取通行证</button></> : selected === 'main' || selected === 'library' ? <><p>{selected === 'main' ? '主楼产出算力。' : '图书馆产出知识。'}当前 {level} 级，最高 5 级；升级前会按旧等级结算收益。</p>{level < 5 ? <><p className="campus-cost">下次升级：知识与算力各 {upgradeCost.toString()} 点</p><button className="btn btn-primary" disabled={actionDisabled || !canUpgrade} onClick={() => void transact({ kind: 'upgrade', building: selected === 'main' ? 0 : 1 }, '升级建筑')}>升级到 {level + 1} 级</button></> : <p className="campus-cost">已达到最高等级。</p>}</> : selected === 'plaza' ? <><p>第 {world?.round.toString()} 轮「点亮邮园」：共需两种资源各 {world?.goal.toString()} 点。所有成员共享进度。</p><div className="campus-progress"><span style={{ width: `${world && world.goal > 0n ? Number(world.progress * 100n / world.goal) : 0}%` }} /></div><p className="campus-progress-label">已投入 {world?.progress.toString()} / {world?.goal.toString()}</p><label className="campus-input-label">各投入多少知识和算力<input type="number" min="1" max={remaining.toString()} step="1" value={contribution} onChange={(event) => setContribution(event.target.value)} /></label><button className="btn btn-primary" disabled={actionDisabled || !canContribute} onClick={() => void transact({ kind: 'contribute', amount: contributionAmount }, '参与公共建设')}>确认贡献</button><small>本轮最多还可投入各 {remaining.toString()} 点；总贡献 {player.contributed.toString()} 点。</small></> : selected === 'sculpture' ? <><p>通行证绑定在当前钱包地址，记录你的校园建设身份。它无法转让，也不会向其他钱包收费。</p><div className="campus-passport"><span>POST CAMPUS</span><strong>共建者 #{user.address.slice(2, 8).toUpperCase()}</strong><small>主楼 Lv.{player.mainLevel} · 图书馆 Lv.{player.libraryLevel}</small></div></> : <><p>想知道收益如何计算、为什么交易需要测试币，以及合约如何判断公共项目完成？</p><Link href="/game/learn" className="btn btn-ghost">打开链游指南 <Icon name="arrow" size={15} /></Link></>}
            </div>
            {player?.joined && <div className="campus-collect"><span>待结算：知识 +{snapshot.pending[0].toString()} · 算力 +{snapshot.pending[1].toString()}</span><button className="text-link" disabled={actionDisabled || (snapshot.pending[0] === 0n && snapshot.pending[1] === 0n)} onClick={() => void transact({ kind: 'collect' }, '领取资源')}>领取资源</button></div>}
            {pendingHash && <div className="campus-tx" role="status"><span>{pendingLabel || '交易'}已提交，等待链上确认…</span>{transactionUrl(config, pendingHash) && <a href={transactionUrl(config, pendingHash)!} target="_blank" rel="noopener noreferrer">查看交易 ↗</a>}</div>}
            {actionError && <div className="inline-notice" role="alert">{actionError}{pendingHash && <button className="text-link" onClick={() => void waitForReceipt(pendingHash).catch((cause) => setActionError(explainError(cause)))}>重试查询</button>}</div>}
            <div className="campus-steps"><span className="eyebrow">FIRST JOURNEY</span><h3>我的第一段链上旅程</h3>{BADGES.slice(0, 3).map((badge, index) => <div key={badge.bit} className={player && (player.badges & badge.bit) ? 'done' : ''}><span>{player && (player.badges & badge.bit) ? '✓' : index + 1}</span>{badge.description}</div>)}</div>
            <div className="campus-badges"><span className="eyebrow">ACHIEVEMENTS</span><h3>共建成就</h3><div>{BADGES.map((badge) => <span key={badge.bit} className={player && (player.badges & badge.bit) ? 'earned' : ''} title={badge.description}>{badge.label}</span>)}</div></div>
          </>}
          <div className="campus-control-foot">{explorerContract && <a href={explorerContract} target="_blank" rel="noopener noreferrer" className="text-link">查看游戏合约 <Icon name="upRight" size={13} /></a>}<Link href="/game/learn" className="text-link">玩法与交易说明 <Icon name="arrow" size={13} /></Link></div>
        </aside>
      </div>
    </div>
  );
}

export function CampusClient() {
  const { user, status, connect, logout } = useWallet();
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    setConfig(null);
    if (!user) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api.gameConfig(controller.signal).then((value) => {
      if (!controller.signal.aborted) setConfig(value);
    }).catch((cause) => {
      if (controller.signal.aborted) return;
      if (cause instanceof ApiError && cause.status === 401) logout();
      setError(explainError(cause));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user, logout]);

  return (
    <div className="campus-page campus-play">
      <div className="campus-play-heading"><div><span className="eyebrow">YOUR ONCHAIN CAMPUS</span><h1>我的链上邮园<span className="heading-dot">.</span></h1><p>点击地标，建设自己的校园，也和伙伴一起推进公共项目。</p></div><Link href="/game/learn" className="text-link">玩法指南 <Icon name="arrow" size={15} /></Link></div>
      {mobile ? <div className="card campus-gate"><h2>建议用电脑浏览器体验</h2><p>目前官网接入浏览器插件钱包。你可以先阅读玩法，稍后用电脑完成链上操作。</p><Link href="/game/learn" className="btn btn-ghost">阅读指南</Link></div> : status === 'loading' || loading ? <div className="card campus-gate" role="status">正在确认成员身份与游戏状态…</div> : !user ? <div className="card campus-gate"><div className="empty-art"><Icon name="wallet" size={30} /></div><h2>连接钱包后进入校园</h2><p>首次登录会自动创建社区账号。游戏使用测试网，你的校园进度跟随钱包地址。</p><button className="btn btn-primary" disabled={status === 'connecting'} onClick={() => void connect()}>{status === 'connecting' ? '等待签名…' : '连接钱包'}</button></div> : error ? <div className="card campus-gate" role="alert"><h2>暂时无法进入</h2><p>{error}</p><button className="btn btn-ghost" onClick={() => window.location.reload()}>重试</button></div> : !config?.enabled || !config.contract_address ? <div className="card campus-gate"><h2>校园即将开放</h2><p>测试网合约尚未启用。你可以先查看玩法与合约教学。</p><Link href="/game/learn" className="btn btn-ghost">阅读指南</Link></div> : <CampusSession key={`${user.address}:${config.contract_address}`} config={config as GameConfig & { contract_address: `0x${string}` }} user={user} />}
    </div>
  );
}
