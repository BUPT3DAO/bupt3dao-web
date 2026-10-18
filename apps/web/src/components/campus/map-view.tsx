'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ClassicCampusMap } from './classic-map';
import type { MapCommands } from './pixi-map';
import {
  daylightAt,
  LANDMARKS,
  LANDSCAPES,
  landscapeStage,
  type CampusEffect,
  type LandmarkId,
  type TimePreference,
} from '@/lib/campus-scene';
import type { CampusPlayer } from '@/lib/campus';

const PixiMap = dynamic(() => import('./pixi-map'), {
  ssr: false,
  loading: () => (
    <div className="campus-scene-loading" role="status">
      正在铺开微缩校园…
    </div>
  ),
});
function readPreference(key: string) {
  try {
    return localStorage.getItem(`bupt3dao.campus.${key}`);
  } catch {
    return null;
  }
}
function storePreference(key: string, value: string) {
  try {
    localStorage.setItem(`bupt3dao.campus.${key}`, value);
  } catch {
    /* preferences are optional */
  }
}

export function CampusMapView({
  player,
  completedRounds,
  selected,
  onSelect,
  focusVersion = 0,
  effect = null,
  preview = false,
}: {
  player: CampusPlayer | null;
  completedRounds: bigint;
  selected: LandmarkId;
  onSelect: (id: LandmarkId) => void;
  focusVersion?: number;
  effect?: CampusEffect | null;
  preview?: boolean;
}) {
  const [renderer, setRenderer] = useState<'miniature' | 'classic'>(
    'miniature',
  );
  const [time, setTime] = useState<TimePreference>('auto');
  const [now, setNow] = useState(() => new Date());
  const [reduced, setReduced] = useState(false);
  const [systemReduced, setSystemReduced] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const commands = useRef<MapCommands | null>(null);
  const pendingFocus = useRef(false);
  const currentSelected = useRef(selected);
  currentSelected.current = selected;
  const previousSelected = useRef(selected);
  const previousFocus = useRef(focusVersion);
  useEffect(() => {
    if (
      previousSelected.current !== selected ||
      previousFocus.current !== focusVersion
    ) {
      if (commands.current) commands.current.focus(selected);
      else pendingFocus.current = true;
    }
    previousSelected.current = selected;
    previousFocus.current = focusVersion;
  }, [selected, focusVersion]);
  useEffect(() => {
    const saved = readPreference('time');
    if (saved && ['auto', 'day', 'dusk', 'night'].includes(saved))
      setTime(saved as TimePreference);
    if (readPreference('renderer') === 'classic') setRenderer('classic');
    setReduced(readPreference('reducedMotion') === 'true');
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setSystemReduced(media.matches);
    sync();
    media.addEventListener('change', sync);
    const wake = () => {
      if (!document.hidden) setNow(new Date());
    };
    const timer = setInterval(wake, 60_000);
    document.addEventListener('visibilitychange', wake);
    return () => {
      media.removeEventListener('change', sync);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, []);
  useEffect(() => {
    if (!immersive) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setImmersive(false);
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [immersive]);
  const onReady = useCallback((next: MapCommands | null) => {
    commands.current = next;
    setReady(!!next);
    if (next && pendingFocus.current) {
      next.focus(currentSelected.current);
      pendingFocus.current = false;
    }
  }, []);
  const onError = useCallback(() => {
    setFailed(true);
    setRenderer('classic');
  }, []);
  const select = (id: LandmarkId) => {
    onSelect(id);
    if (commands.current) commands.current.focus(id);
    else pendingFocus.current = true;
  };
  const motion = reduced || systemReduced || preview;
  const daylight = daylightAt(time, now);
  return (
    <section
      className={`campus-scene-shell ${immersive ? 'campus-immersive' : ''}`}
      data-daylight={daylight}
      data-reduced-motion={motion}
      aria-label={preview ? '公开校园预览' : '我的校园地图'}
    >
      <div className="campus-scene-toolbar">
        <div>
          <span className="eyebrow">POST CAMPUS / MINIATURE 02</span>
          <strong>
            {preview ? '校园预览 · 示例场景' : '在这里，让校园慢慢生长。'}
          </strong>
        </div>
        <div className="campus-map-settings">
          <label>
            <span className="sr-only">地图时段</span>
            <select
              aria-label="地图时段"
              value={time}
              onChange={(e) => {
                setTime(e.target.value as TimePreference);
                storePreference('time', e.target.value);
              }}
            >
              <option value="auto">跟随北京时间</option>
              <option value="day">白天</option>
              <option value="dusk">黄昏</option>
              <option value="night">夜晚</option>
            </select>
          </label>
          <button
            type="button"
            aria-pressed={renderer === 'classic'}
            onClick={() => {
              const next = renderer === 'classic' ? 'miniature' : 'classic';
              setRenderer(next);
              setFailed(false);
              storePreference('renderer', next);
            }}
          >
            {renderer === 'classic' ? '微缩视图' : '经典视图'}
          </button>
          <button
            type="button"
            aria-pressed={immersive}
            onClick={() => setImmersive((v) => !v)}
          >
            {immersive ? '退出沉浸视图' : '展开地图'}
          </button>
        </div>
      </div>
      {failed && (
        <p className="campus-map-fallback" role="status">
          微缩地图暂不可用，已切换到经典视图。你仍可查看和建设校园。
        </p>
      )}
      <div className="campus-map-stage">
        {renderer === 'classic' ? (
          <ClassicCampusMap
            selected={selected}
            onSelect={onSelect}
            player={player}
            completedRounds={completedRounds}
          />
        ) : (
          <>
            <PixiMap
              model={{
                player,
                completedRounds,
                selected,
                daylight,
                reducedMotion: motion,
                effect,
              }}
              onSelect={onSelect}
              onReady={onReady}
              onError={onError}
            />
            {!ready && (
              <div className="campus-map-loading-note" role="status">
                正在加载校园地标…
              </div>
            )}
            <div className="campus-zoom-controls" aria-label="地图缩放">
              <button
                type="button"
                aria-label="放大地图"
                disabled={!ready}
                onClick={() => commands.current?.zoom(1.35)}
              >
                ＋
              </button>
              <button
                type="button"
                aria-label="缩小地图"
                disabled={!ready}
                onClick={() => commands.current?.zoom(1 / 1.35)}
              >
                −
              </button>
              <button
                type="button"
                disabled={!ready}
                onClick={() => commands.current?.reset()}
              >
                回到全景
              </button>
            </div>
            <div className="campus-map-compass" aria-hidden="true">
              N<br />↑
            </div>
          </>
        )}
        <div className="campus-landscape-label">
          <span>共建景观</span>
          <strong>{LANDSCAPES[landscapeStage(completedRounds)]}</strong>
          <small>
            {preview
              ? '展示用示例，不代表真实进度'
              : `已完成 ${completedRounds.toString()} 轮`}
          </small>
        </div>
        {effect && !preview && (
          <p key={effect.id} className="campus-scene-toast" role="status">
            {effect.kind === 'round'
              ? '伙伴们完成了一轮共建，校园景观已更新。'
              : effect.kind === 'upgrade'
                ? '升级已确认，建筑建设进度已更新。'
                : effect.kind === 'collect'
                  ? '领取已确认，资源已结算。'
                  : effect.kind === 'join'
                    ? '欢迎加入邮园，你的校园旅程开始了。'
                    : '贡献已确认，感谢一起建设校园。'}
          </p>
        )}
      </div>
      <nav className="campus-landmark-nav" aria-label="选择校园地标">
        {LANDMARKS.map((l) => (
          <button
            type="button"
            key={l.id}
            aria-pressed={selected === l.id}
            onClick={() => select(l.id)}
          >
            {l.title}
            <small>
              {l.id === 'main'
                ? `Lv.${player?.mainLevel ?? 1}`
                : l.id === 'library'
                  ? `Lv.${player?.libraryLevel ?? 1}`
                  : l.id === 'plaza'
                    ? '一起共建'
                    : l.id === 'sculpture'
                      ? '校园身份'
                      : '玩法指南'}
            </small>
          </button>
        ))}
      </nav>
      <div className="campus-scene-caption">
        <span>
          融合西土城与沙河地标的艺术化地图 · 广场布局与实验室为艺术创作 ·
          人物为氛围装饰
        </span>
        <label>
          <input
            type="checkbox"
            checked={motion}
            disabled={systemReduced || preview}
            onChange={(e) => {
              setReduced(e.target.checked);
              storePreference('reducedMotion', String(e.target.checked));
            }}
          />
          减少动态效果
        </label>
      </div>
    </section>
  );
}
