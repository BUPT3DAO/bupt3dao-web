'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Hash } from 'viem';
import { CAMPUS_ABI } from '@/lib/campus';
import { api, getToken } from '@/lib/api';
import {
  explainCampusError,
  makeCampusClient,
  readCampus,
  type EnabledGame,
  type Move,
} from '@/lib/campus-chain';
import {
  mayTransact,
  type CampusEffect,
  type CampusSnapshot,
  type TxPhase,
} from '@/lib/campus-scene';

function savePending(key: string, hash: string | null) {
  try {
    if (hash) localStorage.setItem(key, hash);
    else localStorage.removeItem(key);
  } catch {
    /* The current page still tracks transactions when storage is disabled. */
  }
}

export function useCampusSession(
  config: EnabledGame,
  address: `0x${string}`,
  readOnly: boolean,
  invalidate: (cause: unknown) => void,
) {
  const [snapshot, setSnapshot] = useState<CampusSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<TxPhase>('idle');
  const [hash, setHash] = useState<Hash | null>(null);
  const [lastHash, setLastHash] = useState<Hash | null>(null);
  const [effect, setEffect] = useState<CampusEffect | null>(null);
  const [wallet, setWallet] = useState<{ address?: string; chain?: number }>(
    {},
  );
  const key = `bupt3dao.campus.pending.${config.chain_id}.${config.contract_address}.${address}`;
  const token = useRef(getToken());
  const mounted = useRef(false);
  const epoch = useRef(0);
  const revision = useRef(0);
  const flight = useRef(false);
  const pending = useRef<Hash | null>(null);
  const latest = useRef<CampusSnapshot | null>(null);
  const confirmedEffects = useRef(new Set<string>());
  const minimumBlock = useRef<bigint | undefined>(undefined);
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;
  const alive = useCallback(
    () => mounted.current && getToken() === token.current,
    [],
  );
  const guardAccess = useCallback(async () => {
    const generation = epoch.current;
    try {
      const next = await api.gameConfig();
      if (!alive() || generation !== epoch.current)
        throw new Error('登录状态已变化');
      if (
        !next.enabled ||
        next.contract_address?.toLowerCase() !==
          config.contract_address.toLowerCase() ||
        next.rpc_url !== config.rpc_url ||
        next.chain_id !== config.chain_id
      ) {
        throw new Error('游戏配置已变化，请重新进入校园。');
      }
    } catch (cause) {
      if (alive() && generation === epoch.current) {
        setSnapshot(null);
        latest.current = null;
        setEffect(null);
        invalidate(cause);
      }
      throw cause;
    }
  }, [alive, config, invalidate]);

  const refresh = useCallback(
    async (quiet = false, baseline = false) => {
      const generation = epoch.current;
      const request = ++revision.current;
      if (alive()) {
        setLoading(true);
        setError('');
      }
      try {
        await guardAccess();
        const next = await readCampus(config, address, minimumBlock.current);
        if (
          !alive() ||
          generation !== epoch.current ||
          request !== revision.current
        )
          return null;
        const previous = latest.current;
        latest.current = next;
        setSnapshot(next);
        if (!baseline && previous && next.world.round > previous.world.round) {
          const id = `round:${next.world.round}`;
          if (!confirmedEffects.current.has(id)) {
            confirmedEffects.current.add(id);
            setEffect({ id, kind: 'round', landmark: 'plaza' });
          }
        }
        return next;
      } catch (cause) {
        if (
          alive() &&
          generation === epoch.current &&
          request === revision.current
        ) {
          setSnapshot(null);
          latest.current = null;
          setError(`链上数据暂时无法读取：${explainCampusError(cause)}`);
        }
        if (!quiet) throw cause;
        return null;
      } finally {
        if (
          alive() &&
          generation === epoch.current &&
          request === revision.current
        )
          setLoading(false);
      }
    },
    [address, alive, config, guardAccess],
  );

  const wait = useCallback(
    async (initialHash: Hash, move?: Move, recovered = false) => {
      const generation = epoch.current;
      const previousRound = latest.current?.world.round;
      let finalHash = initialHash;
      let cancelled = false;
      const receipt = await makeCampusClient(config).waitForTransactionReceipt({
        hash: initialHash,
        timeout: 90_000,
        onReplaced: ({ reason, transaction }) => {
          cancelled = reason !== 'repriced';
          finalHash = transaction.hash;
          if (!alive() || generation !== epoch.current) return;
          pending.current = finalHash;
          savePending(key, finalHash);
          setHash(finalHash);
          setLastHash(finalHash);
        },
      });
      if (!alive() || generation !== epoch.current) return;
      if (cancelled || receipt.status !== 'success') {
        pending.current = null;
        setHash(null);
        savePending(key, null);
        setPhase(cancelled ? 'cancelled' : 'failed');
        setError(
          cancelled
            ? '交易已取消，校园进度未改变。'
            : '交易已上链，但合约执行失败。',
        );
        return;
      }
      setPhase('syncing');
      minimumBlock.current = receipt.blockNumber;
      const next = await refresh(false, recovered);
      if (!alive() || generation !== epoch.current || !next) return;
      pending.current = null;
      setHash(null);
      savePending(key, null);
      setPhase('success');
      if (!recovered && move && !confirmedEffects.current.has(finalHash)) {
        confirmedEffects.current.add(finalHash);
        const roundAdvanced =
          move.kind === 'contribute' &&
          previousRound !== undefined &&
          next.world.round > previousRound;
        setEffect({
          id: finalHash,
          kind: roundAdvanced ? 'round' : move.kind,
          landmark:
            move.kind === 'upgrade'
              ? move.building === 0
                ? 'main'
                : 'library'
              : move.kind === 'contribute'
                ? 'plaza'
                : 'sculpture',
        });
      }
    },
    [alive, config, key, refresh],
  );

  const handleFailure = useCallback(
    (cause: unknown) => {
      if (!alive()) return;
      const message = explainCampusError(cause);
      const timedOut = /timeout|timed out/i.test(
        cause instanceof Error ? cause.name + cause.message : '',
      );
      setPhase(
        timedOut || pending.current
          ? 'timeout'
          : /取消/.test(message)
            ? 'rejected'
            : 'failed',
      );
      setError(
        pending.current
          ? '交易可能已经上链，暂时无法确认或同步。请重试查询，不要重复提交。'
          : message,
      );
    },
    [alive],
  );

  const transact = useCallback(
    async (move: Move) => {
      if (
        !mayTransact(
          readOnlyRef.current,
          wallet.address?.toLowerCase() === address.toLowerCase(),
          !!latest.current?.world.stopped,
          phase,
          !!pending.current,
        ) ||
        flight.current ||
        !latest.current
      )
        return;
      flight.current = true;
      setPhase('wallet');
      setError('');
      setEffect(null);
      const generation = epoch.current;
      try {
        await guardAccess();
        const [runtime, actions] = await Promise.all([
          import('@/components/web3-providers'),
          import('wagmi/actions'),
        ]);
        const check = () => {
          const current = actions.getAccount(runtime.config);
          if (
            !alive() ||
            generation !== epoch.current ||
            readOnlyRef.current ||
            current.address?.toLowerCase() !== address.toLowerCase()
          )
            throw new Error('钱包或登录状态已变化，请重新连接。');
          return current;
        };
        const connected = check();
        const chainId = config.chain_id as 1 | 84532 | 31337;
        if (connected.chainId !== chainId)
          await actions.switchChain(runtime.config, { chainId });
        if ((await makeCampusClient(config).getBalance({ address })) === 0n)
          throw new Error('insufficient funds');
        check();
        if (actions.getAccount(runtime.config).chainId !== chainId)
          throw new Error('钱包网络不匹配，请切换到 Base Sepolia。');
        const common = {
          address: config.contract_address,
          abi: CAMPUS_ABI,
          chainId,
        } as const;
        const submitted =
          move.kind === 'join'
            ? await actions.writeContract(runtime.config, {
                ...common,
                functionName: 'join',
              })
            : move.kind === 'collect'
              ? await actions.writeContract(runtime.config, {
                  ...common,
                  functionName: 'collect',
                })
              : move.kind === 'upgrade'
                ? await actions.writeContract(runtime.config, {
                    ...common,
                    functionName: 'upgrade',
                    args: [move.building],
                  })
                : await actions.writeContract(runtime.config, {
                    ...common,
                    functionName: 'contribute',
                    args: [move.amount],
                  });
        savePending(key, submitted);
        if (!alive() || generation !== epoch.current) return;
        pending.current = submitted;
        setHash(submitted);
        setLastHash(submitted);
        setPhase('submitted');
        await wait(submitted, move);
      } catch (cause) {
        if (generation === epoch.current) handleFailure(cause);
      } finally {
        if (generation === epoch.current) flight.current = false;
      }
    },
    [
      address,
      alive,
      config,
      guardAccess,
      handleFailure,
      key,
      phase,
      wait,
      wallet.address,
    ],
  );

  const retry = useCallback(async () => {
    if (!pending.current || flight.current) return;
    flight.current = true;
    setPhase('submitted');
    setError('');
    const generation = epoch.current;
    try {
      await guardAccess();
      await wait(pending.current, undefined, true);
    } catch (cause) {
      if (generation === epoch.current) handleFailure(cause);
    } finally {
      if (generation === epoch.current) flight.current = false;
    }
  }, [guardAccess, handleFailure, wait]);

  useEffect(() => {
    mounted.current = true;
    const generation = ++epoch.current;
    token.current = getToken();
    void refresh(true, true);
    let stopped = false;
    let unwatch = () => {};
    void Promise.all([
      import('@/components/web3-providers'),
      import('wagmi/actions'),
    ])
      .then(([runtime, actions]) => {
        if (stopped) return;
        const current = actions.getAccount(runtime.config);
        setWallet({ address: current.address, chain: current.chainId });
        unwatch = actions.watchAccount(runtime.config, {
          onChange(next, previous) {
            if (stopped) return;
            setWallet({ address: next.address, chain: next.chainId });
            if (
              previous.address &&
              next.address?.toLowerCase() !== address.toLowerCase()
            ) {
              setSnapshot(null);
              latest.current = null;
              setEffect(null);
              invalidate(new Error('钱包已切换或断开，请重新登录。'));
            }
          },
        });
      })
      .catch(() => {});
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(key);
    } catch {
      /* optional persistence */
    }
    if (saved && /^0x[\da-fA-F]{64}$/.test(saved)) {
      const savedHash = saved as Hash;
      pending.current = savedHash;
      setHash(savedHash);
      setLastHash(savedHash);
      setPhase('submitted');
      flight.current = true;
      void wait(savedHash, undefined, true)
        .catch((cause) => {
          if (generation === epoch.current) handleFailure(cause);
        })
        .finally(() => {
          if (generation === epoch.current) flight.current = false;
        });
    }
    const wake = () => {
      if (!document.hidden && !flight.current) void refresh(true);
    };
    const timer = window.setInterval(wake, 60_000);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    return () => {
      stopped = true;
      mounted.current = false;
      unwatch();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
    };
  }, [address, handleFailure, invalidate, key, refresh, wait]);

  return {
    snapshot,
    loading,
    error,
    phase,
    hash,
    lastHash,
    effect,
    wallet,
    refresh: () => void refresh(true),
    transact,
    retry,
  };
}
