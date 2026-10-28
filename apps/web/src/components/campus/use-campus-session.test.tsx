import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Hash } from 'viem';
import type { CampusSnapshot } from '@/lib/campus-scene';
import { useCampusSession } from './use-campus-session';
import { ApiError } from '@/lib/api';

const mock = vi.hoisted(() => ({
  token: 'member-token',
  read: vi.fn(),
  access: vi.fn(),
  receipt: vi.fn(),
  balance: vi.fn(),
  write: vi.fn(),
  watch: vi.fn(),
  account: {
    address: '0x0000000000000000000000000000000000000001',
    chainId: 84532,
  },
}));
vi.mock('@/lib/api', async (original) => ({
  ...(await original<typeof import('@/lib/api')>()),
  getToken: () => mock.token,
  api: { gameConfig: mock.access },
}));
vi.mock('@/lib/campus-chain', async (original) => ({
  ...(await original<typeof import('@/lib/campus-chain')>()),
  readCampus: mock.read,
  makeCampusClient: () => ({
    getBalance: mock.balance,
    waitForTransactionReceipt: mock.receipt,
  }),
}));
vi.mock('@/components/web3-providers', () => ({ config: {} }));
vi.mock('wagmi/actions', () => ({
  getAccount: () => mock.account,
  watchAccount: mock.watch,
  writeContract: mock.write,
  switchChain: vi.fn(),
}));
const address = '0x0000000000000000000000000000000000000001';
const config = {
  enabled: true,
  chain_id: 84532,
  contract_address: '0x0000000000000000000000000000000000000002' as const,
  rpc_url: 'https://rpc.example',
  explorer_url: null,
  faucet_url: null,
};
const hash = `0x${'a'.repeat(64)}` as Hash;
const nextHash = `0x${'b'.repeat(64)}` as Hash;
const key = `bupt3dao.campus.pending.84532.${config.contract_address}.${address}`;
const snapshot: CampusSnapshot = {
  player: {
    joined: true,
    knowledge: 100n,
    compute: 100n,
    contributed: 0n,
    mainLevel: 1,
    libraryLevel: 1,
    badges: 1,
  },
  world: { round: 1n, progress: 0n, goal: 1000n, stopped: false },
  pending: [40n, 40n],
  gas: 1n,
  block: 10n,
};
let invalidate = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mock.token = 'member-token';
  invalidate = vi.fn();
  mock.access.mockResolvedValue(config);
  mock.read.mockResolvedValue(snapshot);
  mock.balance.mockResolvedValue(1n);
  mock.write.mockResolvedValue(hash);
  mock.receipt.mockResolvedValue({ status: 'success', blockNumber: 11n });
  mock.watch.mockReturnValue(() => {});
});
afterEach(cleanup);
async function setup(readOnly = false) {
  const hook = renderHook(() =>
    useCampusSession(config, address, readOnly, invalidate),
  );
  await waitFor(() => {
    expect(hook.result.current.snapshot).not.toBeNull();
    expect(hook.result.current.wallet.address).toBe(address);
  });
  return hook;
}
describe('campus session and transaction lifecycle', () => {
  it('keeps previewed resources intact and blocks writes in read-only mode', async () => {
    const { result } = await setup(true);
    expect(result.current.snapshot?.player.knowledge).toBe(100n);
    await act(async () => result.current.transact({ kind: 'collect' }));
    expect(mock.write).not.toHaveBeenCalled();
  });
  it('applies an upgrade only after receipt and synchronized snapshot', async () => {
    const { result } = await setup();
    mock.read.mockResolvedValue({
      ...snapshot,
      player: { ...snapshot.player, mainLevel: 2 },
    });
    await act(async () =>
      result.current.transact({ kind: 'upgrade', building: 0 }),
    );
    expect(mock.read).toHaveBeenLastCalledWith(config, address, 11n);
    expect(result.current.phase).toBe('success');
    expect(result.current.effect).toMatchObject({ kind: 'upgrade', id: hash });
    expect(localStorage.getItem(key)).toBeNull();
  });
  it('handles wallet refusal without creating a pending transaction', async () => {
    const { result } = await setup();
    mock.write.mockRejectedValue(
      Object.assign(new Error('denied'), { code: 4001 }),
    );
    await act(async () => result.current.transact({ kind: 'collect' }));
    expect(result.current.phase).toBe('rejected');
    expect(result.current.effect).toBeNull();
    expect(mock.receipt).not.toHaveBeenCalled();
  });
  it.each(['cancelled', 'replaced'])(
    'does not celebrate a %s replacement',
    async (reason) => {
      const { result } = await setup();
      mock.receipt.mockImplementation(async (options) => {
        options.onReplaced({ reason, transaction: { hash: nextHash } });
        return { status: 'success', blockNumber: 11n };
      });
      await act(async () => result.current.transact({ kind: 'collect' }));
      expect(result.current.phase).toBe('cancelled');
      expect(result.current.effect).toBeNull();
      expect(result.current.hash).toBeNull();
    },
  );
  it('follows a repriced transaction and identifies the effect by its final hash', async () => {
    const { result } = await setup();
    mock.receipt.mockImplementation(async (options) => {
      options.onReplaced({
        reason: 'repriced',
        transaction: { hash: nextHash },
      });
      return { status: 'success', blockNumber: 11n };
    });
    await act(async () => result.current.transact({ kind: 'collect' }));
    expect(result.current.effect?.id).toBe(nextHash);
    expect(result.current.phase).toBe('success');
  });
  it('keeps timeouts pending, prevents duplicate submission, and retries without replaying animation', async () => {
    const { result } = await setup();
    mock.receipt.mockRejectedValue(new Error('request timeout'));
    await act(async () => result.current.transact({ kind: 'collect' }));
    expect(result.current.phase).toBe('timeout');
    expect(result.current.hash).toBe(hash);
    await act(async () => result.current.transact({ kind: 'collect' }));
    expect(mock.write).toHaveBeenCalledTimes(1);
    mock.receipt.mockResolvedValue({ status: 'success', blockNumber: 11n });
    await act(async () => result.current.retry());
    expect(result.current.phase).toBe('success');
    expect(result.current.effect).toBeNull();
  });
  it('does not show success if receipt reverted', async () => {
    const { result } = await setup();
    mock.receipt.mockResolvedValue({ status: 'reverted', blockNumber: 11n });
    await act(async () => result.current.transact({ kind: 'collect' }));
    expect(result.current.phase).toBe('failed');
    expect(result.current.effect).toBeNull();
  });
  it('preserves pending recovery if the successful receipt cannot yet be synchronized', async () => {
    const { result } = await setup();
    mock.read.mockRejectedValue(new Error('RPC unavailable'));
    await act(async () => result.current.transact({ kind: 'collect' }));
    expect(result.current.snapshot).toBeNull();
    expect(result.current.hash).toBe(hash);
    expect(result.current.phase).toBe('timeout');
    expect(result.current.effect).toBeNull();
    mock.read.mockResolvedValue(snapshot);
    await act(async () => result.current.retry());
    expect(result.current.phase).toBe('success');
  });
  it('restores historical pending transactions without a fresh celebration', async () => {
    localStorage.setItem(key, hash);
    const { result } = await setup();
    await waitFor(() => expect(result.current.phase).toBe('success'));
    expect(result.current.effect).toBeNull();
    expect(mock.write).not.toHaveBeenCalled();
  });
  it.each([401, 403])(
    'invalidates private UI on access failure %s before another RPC read',
    async (code) => {
      const { result } = await setup();
      const reads = mock.read.mock.calls.length;
      mock.access.mockRejectedValue(new ApiError('access denied', code));
      await act(async () => result.current.refresh());
      await waitFor(() => expect(invalidate).toHaveBeenCalled());
      expect(result.current.snapshot).toBeNull();
      expect(mock.read).toHaveBeenCalledTimes(reads);
    },
  );
  it('suppresses old RPC results after session token changes', async () => {
    const { result } = await setup();
    let resolve!: (s: CampusSnapshot) => void;
    mock.read.mockReturnValue(
      new Promise<CampusSnapshot>((done) => {
        resolve = done;
      }),
    );
    act(() => result.current.refresh());
    await waitFor(() => expect(mock.read).toHaveBeenCalledTimes(2));
    mock.token = 'new-wallet-token';
    await act(async () =>
      resolve({ ...snapshot, player: { ...snapshot.player, knowledge: 999n } }),
    );
    expect(result.current.snapshot?.player.knowledge).toBe(100n);
    expect(result.current.effect).toBeNull();
  });
  it('shows a new world round only after a baseline was observed', async () => {
    mock.read.mockResolvedValue({
      ...snapshot,
      world: { ...snapshot.world, round: 4n },
    });
    const { result } = await setup();
    expect(result.current.effect).toBeNull();
    mock.read.mockResolvedValue({
      ...snapshot,
      world: { ...snapshot.world, round: 5n },
    });
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.effect?.id).toBe('round:5'));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.effect?.id).toBe('round:5');
  });
});
