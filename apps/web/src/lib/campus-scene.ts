import type { CampusPlayer, CampusWorld } from './campus';

export type LandmarkId = 'main' | 'library' | 'plaza' | 'sculpture' | 'lab';
export type TimePreference = 'auto' | 'day' | 'dusk' | 'night';
export type Daylight = Exclude<TimePreference, 'auto'>;
export type DetailLevel = 'world' | 'district' | 'close';
export type CampusEffect = {
  id: string;
  kind: 'join' | 'collect' | 'upgrade' | 'contribute' | 'round';
  landmark: LandmarkId;
};
export type CampusSnapshot = {
  player: CampusPlayer;
  world: CampusWorld;
  pending: readonly [bigint, bigint];
  gas: bigint;
  block: bigint;
};
export type CampusViewModel = {
  player: CampusPlayer | null;
  completedRounds: bigint;
  selected: LandmarkId;
  daylight: Daylight;
  reducedMotion: boolean;
  effect: CampusEffect | null;
};

export const SCENE = { width: 1600, height: 1200 };
export const LANDMARKS: ReadonlyArray<{
  id: LandmarkId;
  title: string;
  subtitle: string;
  x: number;
  y: number;
  width: number;
  height: number;
  artistic?: boolean;
}> = [
  {
    id: 'library',
    title: '沙河图书馆',
    subtitle: '知识 · 红砖与玻璃',
    x: 405,
    y: 420,
    width: 420,
    height: 310,
  },
  {
    id: 'main',
    title: '西土城主楼',
    subtitle: '算力 · 校园天际线',
    x: 1150,
    y: 410,
    width: 470,
    height: 410,
  },
  {
    id: 'plaza',
    title: '时光广场',
    subtitle: '公共建设',
    x: 800,
    y: 710,
    width: 255,
    height: 240,
    artistic: true,
  },
  {
    id: 'sculpture',
    title: '大龙邮票石雕',
    subtitle: '通行证 · 园路浮雕',
    x: 350,
    y: 940,
    width: 215,
    height: 170,
  },
  {
    id: 'lab',
    title: '链协实验室',
    subtitle: '学习与探索',
    x: 1220,
    y: 960,
    width: 310,
    height: 270,
    artistic: true,
  },
];

export function buildingLevel(id: LandmarkId, player: CampusPlayer | null) {
  return Math.min(
    5,
    Math.max(
      1,
      id === 'main'
        ? (player?.mainLevel ?? 1)
        : id === 'library'
          ? (player?.libraryLevel ?? 1)
          : 1,
    ),
  );
}
export function landscapeStage(rounds: bigint): 0 | 1 | 2 | 3 {
  return rounds <= 0n ? 0 : rounds === 1n ? 1 : rounds === 2n ? 2 : 3;
}
export const LANDSCAPES = [
  '等待一起点亮',
  '步道已点亮',
  '共建花园已开放',
  '广场纪念装置已建成',
] as const;
export function daylightAt(
  preference: TimePreference,
  now = new Date(),
): Daylight {
  if (preference !== 'auto') return preference;
  const hour = (now.getUTCHours() + 8) % 24;
  return hour >= 6 && hour < 17
    ? 'day'
    : hour >= 17 && hour < 19
      ? 'dusk'
      : 'night';
}
export function detailAt(zoom: number, previous: DetailLevel): DetailLevel {
  if (previous === 'world')
    return zoom > 1.25 ? (zoom > 2.2 ? 'close' : 'district') : 'world';
  if (previous === 'close')
    return zoom < 2.05 ? (zoom < 1.1 ? 'world' : 'district') : 'close';
  return zoom < 1.1 ? 'world' : zoom > 2.2 ? 'close' : 'district';
}
export type Camera = { x: number; y: number; zoom: number };
export function clampCamera(
  camera: Camera,
  width: number,
  height: number,
  fit: number,
): Camera {
  const zoom = Math.max(1, Math.min(3.4, camera.zoom));
  const scale = fit * zoom;
  const boundX = Math.max(0, (SCENE.width * scale - width) / 2);
  const boundY = Math.max(0, (SCENE.height * scale - height) / 2);
  return {
    zoom,
    x: Math.max(-boundX, Math.min(boundX, camera.x)),
    y: Math.max(-boundY, Math.min(boundY, camera.y)),
  };
}
export function zoomCamera(
  camera: Camera,
  nextZoom: number,
  pointX: number,
  pointY: number,
): Camera {
  const zoom = Math.max(1, Math.min(3.4, nextZoom));
  const ratio = zoom / camera.zoom;
  return {
    zoom,
    x: pointX - (pointX - camera.x) * ratio,
    y: pointY - (pointY - camera.y) * ratio,
  };
}
export const JOURNEY: ReadonlyArray<{
  bit: number;
  landmark: LandmarkId;
  title: string;
  explanation: string;
}> = [
  {
    bit: 1,
    landmark: 'sculpture',
    title: '领取共建者通行证',
    explanation: '第一笔测试网交易，建立你的校园身份。',
  },
  {
    bit: 2,
    landmark: 'main',
    title: '首次升级校园建筑',
    explanation: '升级自动结算收益，再提高建筑产量。',
  },
  {
    bit: 4,
    landmark: 'plaza',
    title: '首次参与公共建设',
    explanation: '与伙伴投入资源，一起改变校园景观。',
  },
];
export function isMobileVisitor(
  width: number,
  userAgent: string,
  coarse: boolean,
  touchPoints: number,
) {
  return (
    width <= 760 ||
    /Android|iPhone|iPad|iPod/i.test(userAgent) ||
    (coarse && touchPoints > 1)
  );
}

export type TxPhase =
  | 'idle'
  | 'wallet'
  | 'submitted'
  | 'syncing'
  | 'success'
  | 'rejected'
  | 'cancelled'
  | 'failed'
  | 'timeout';
export function isBusy(phase: TxPhase) {
  return phase === 'wallet' || phase === 'submitted' || phase === 'syncing';
}
export function mayTransact(
  readOnly: boolean,
  walletMatches: boolean,
  stopped: boolean,
  phase: TxPhase,
  pending: boolean,
) {
  return !readOnly && walletMatches && !stopped && !isBusy(phase) && !pending;
}
