import type { GameConfig } from '@/types';

export const CAMPUS_ABI = [
  {
    type: 'function', name: 'getPlayer', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{
      name: 'player', type: 'tuple', components: [
        { name: 'knowledge', type: 'uint256' },
        { name: 'compute', type: 'uint256' },
        { name: 'knowledgeRemainder', type: 'uint256' },
        { name: 'computeRemainder', type: 'uint256' },
        { name: 'lastAccrued', type: 'uint256' },
        { name: 'contributed', type: 'uint256' },
        { name: 'mainLevel', type: 'uint8' },
        { name: 'libraryLevel', type: 'uint8' },
        { name: 'badges', type: 'uint8' },
        { name: 'joined', type: 'bool' },
      ],
    }],
  },
  {
    type: 'function', name: 'getWorld', stateMutability: 'view', inputs: [],
    outputs: [
      { name: 'round', type: 'uint256' },
      { name: 'goal', type: 'uint256' },
      { name: 'progress', type: 'uint256' },
      { name: 'stopped', type: 'bool' },
    ],
  },
  {
    type: 'function', name: 'getPending', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'knowledge', type: 'uint256' },
      { name: 'compute', type: 'uint256' },
    ],
  },
  { type: 'function', name: 'join', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'collect', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    type: 'function', name: 'upgrade', stateMutability: 'nonpayable',
    inputs: [{ name: 'building', type: 'uint8' }], outputs: [],
  },
  {
    type: 'function', name: 'contribute', stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }], outputs: [],
  },
] as const;

export interface CampusPlayer {
  knowledge: bigint;
  compute: bigint;
  contributed: bigint;
  mainLevel: number;
  libraryLevel: number;
  badges: number;
  joined: boolean;
}

export interface CampusWorld {
  round: bigint;
  goal: bigint;
  progress: bigint;
  stopped: boolean;
}

export const BADGES = [
  { bit: 1, label: '初入邮园', description: '领取共建者通行证' },
  { bit: 2, label: '第一座建筑', description: '首次升级校园建筑' },
  { bit: 4, label: '共同点亮', description: '首次参与公共建设' },
  { bit: 8, label: '校园建设者', description: '两座生产建筑均达到五级' },
  { bit: 16, label: '协作先锋', description: '累计贡献 100 点资源' },
  { bit: 32, label: '邮园合伙人', description: '累计贡献 1000 点资源' },
] as const;

export function transactionUrl(config: GameConfig, hash: `0x${string}`): string | null {
  return config.explorer_url ? `${config.explorer_url}/tx/${hash}` : null;
}

export function contractUrl(config: GameConfig): string | null {
  return config.explorer_url && config.contract_address
    ? `${config.explorer_url}/address/${config.contract_address}` : null;
}
