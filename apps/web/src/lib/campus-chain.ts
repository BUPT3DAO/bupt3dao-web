import { createPublicClient, http, type Hash } from 'viem';
import { baseSepolia, foundry } from 'viem/chains';
import { CAMPUS_ABI, type CampusPlayer } from './campus';
import type { CampusSnapshot } from './campus-scene';
import type { GameConfig } from '@/types';

export type EnabledGame = GameConfig & { contract_address: `0x${string}` };
export type Move =
  | { kind: 'join' }
  | { kind: 'collect' }
  | { kind: 'upgrade'; building: 0 | 1 }
  | { kind: 'contribute'; amount: bigint };
export function makeCampusClient(config: GameConfig) {
  return createPublicClient({
    chain: config.chain_id === 31337 ? foundry : baseSepolia,
    transport: http(config.rpc_url, { timeout: 12_000, retryCount: 1 }),
  });
}
export function decodePlayer(raw: unknown): CampusPlayer {
  const field = (name: string, index: number) =>
    Array.isArray(raw) ? raw[index] : (raw as Record<string, unknown>)[name];
  return {
    knowledge: BigInt(field('knowledge', 0) as bigint),
    compute: BigInt(field('compute', 1) as bigint),
    contributed: BigInt(field('contributed', 5) as bigint),
    mainLevel: Number(field('mainLevel', 6)),
    libraryLevel: Number(field('libraryLevel', 7)),
    badges: Number(field('badges', 8)),
    joined: Boolean(field('joined', 9)),
  };
}
export async function readCampus(
  config: EnabledGame,
  account: `0x${string}`,
  minimumBlock?: bigint,
): Promise<CampusSnapshot> {
  const client = makeCampusClient(config);
  const latest = await client.getBlockNumber({ cacheTime: 0 });
  const blockNumber =
    minimumBlock && minimumBlock > latest ? minimumBlock : latest;
  const common = {
    address: config.contract_address,
    abi: CAMPUS_ABI,
    blockNumber,
  } as const;
  const [raw, world, pending, gas] = await Promise.all([
    client.readContract({
      ...common,
      functionName: 'getPlayer',
      args: [account],
    }),
    client.readContract({ ...common, functionName: 'getWorld' }),
    client.readContract({
      ...common,
      functionName: 'getPending',
      args: [account],
    }),
    client.getBalance({ address: account, blockNumber }),
  ]);
  return {
    player: decodePlayer(raw),
    world: {
      round: world[0],
      goal: world[1],
      progress: world[2],
      stopped: world[3],
    },
    pending,
    gas,
    block: blockNumber,
  };
}
export function explainCampusError(cause: unknown) {
  if (!(cause instanceof Error)) return '操作未完成，请稍后重试。';
  const e = cause as Error & { code?: number; shortMessage?: string };
  if (
    e.code === 4001 ||
    /UserRejectedRequestError|rejected|denied/i.test(e.name + e.message)
  )
    return '已在钱包中取消操作。';
  if (/InsufficientResources/.test(e.message))
    return '知识或算力不足，请等待产出后重试。';
  if (/InvalidContribution/.test(e.message))
    return '公共项目进度已变化，请刷新后重新输入贡献量。';
  if (/insufficient funds/i.test(e.message))
    return '测试币不足，请先领取 Base Sepolia 测试 ETH。';
  return e.shortMessage ?? e.message;
}
export interface PendingTransaction {
  hash: Hash;
  move?: Move;
  recovered?: boolean;
}
