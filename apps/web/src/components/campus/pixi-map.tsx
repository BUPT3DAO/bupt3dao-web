'use client';

import { useEffect, useRef } from 'react';
import {
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  isWebGLSupported,
} from 'pixi.js';
import {
  buildingLevel,
  clampCamera,
  detailAt,
  landscapeStage,
  LANDMARKS,
  SCENE,
  zoomCamera,
  type Camera,
  type CampusViewModel,
  type LandmarkId,
} from '@/lib/campus-scene';

export interface MapCommands {
  zoom: (factor: number) => void;
  reset: () => void;
  focus: (id: LandmarkId) => void;
}
export default function PixiCampusMap({
  model,
  effectLedger,
  onSelect,
  onReady,
  onError,
}: {
  model: CampusViewModel;
  effectLedger: Set<string>;
  onSelect: (id: LandmarkId) => void;
  onReady: (commands: MapCommands | null) => void;
  onError: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ model, onSelect, onReady, onError });
  live.current = { model, onSelect, onReady, onError };
  const redraw = useRef<() => void>(() => {});
  useEffect(() => {
    redraw.current();
  }, [model]);

  useEffect(() => {
    const element = host.current!;
    const app = new Application();
    let disposed = false;
    let initialized = false;
    let observer: ResizeObserver | null = null;
    let detach = () => {};
    const run = async () => {
      if (!isWebGLSupported()) throw new Error('WebGL unavailable');
      await app.init({
        preference: 'webgl',
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(
          window.devicePixelRatio || 1,
          matchMedia('(pointer: coarse)').matches ? 1.5 : 2,
        ),
        powerPreference: 'low-power',
      });
      initialized = true;
      if (disposed) {
        app.destroy(true, { children: true });
        return;
      }
      const canvas = app.canvas as HTMLCanvasElement;
      element.appendChild(canvas);
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.touchAction = 'none';
      const root = new Container();
      const ground = new Container();
      const buildings = new Container();
      const decor = new Container();
      const labels = new Container();
      const particles = new Container();
      root.addChild(ground, buildings, decor, particles, labels);
      app.stage.addChild(root);
      root.hitArea = new Rectangle(0, 0, SCENE.width, SCENE.height);
      const base = new Graphics()
        .roundRect(12, 12, 1576, 1176, 120)
        .fill(0xb9c8ad);
      base.roundRect(32, 30, 1536, 1140, 110).fill(0xd2dbc3);
      for (let i = 0; i < 1400; i++)
        base
          .circle(
            70 + ((i * 227.3) % 1460),
            65 + ((i * 149.7) % 1070),
            1 + (i % 3),
          )
          .fill({ color: i % 2 ? 0x8a9c7e : 0xf7f3d9, alpha: 0.17 });
      const road = (width: number, color: number) => {
        base
          .moveTo(130, 1100)
          .bezierCurveTo(360, 980, 600, 730, 800, 730)
          .bezierCurveTo(1080, 730, 1350, 930, 1500, 1100)
          .stroke({ width, color, cap: 'round' });
        base
          .moveTo(405, 480)
          .bezierCurveTo(430, 610, 620, 620, 800, 730)
          .bezierCurveTo(1020, 620, 1130, 580, 1150, 475)
          .stroke({ width, color, cap: 'round' });
      };
      road(65, 0xa4af97);
      road(56, 0xe3d9c2);
      road(2, 0xc4bca7);
      base
        .ellipse(800, 735, 190, 94)
        .fill(0xd0c6ae)
        .ellipse(800, 730, 178, 85)
        .fill(0xe4dac5);
      ground.addChild(base);
      const treeTexture = await Assets.load('/campus/v2/tree-low.webp');
      if (disposed) return;
      for (let i = 0; i < 65; i++) {
        const x = 120 + ((i * 173) % 1380),
          y = 110 + ((i * 281) % 990);
        if (
          LANDMARKS.some(
            (l) =>
              Math.abs(l.x - x) < l.width * 0.6 &&
              y > l.y - l.height &&
              y < l.y + 100,
          ) ||
          Math.abs(y - 700) < 70
        )
          continue;
        base
          .ellipse(x + 12, y + 18, 23, 11)
          .fill({ color: 0x435a3c, alpha: 0.18 });
        const tree = new Sprite(treeTexture);
        tree.anchor.set(0.5, 0.97);
        tree.position.set(x, y + 10);
        tree.width = 70 + (i % 3) * 12;
        tree.scale.y = tree.scale.x;
        tree.tint = i % 3 ? 0xffffff : 0xd5d8b3;
        ground.addChild(tree);
      }
      ground.cacheAsTexture({ resolution: 1 });
      const sprites = new Map<LandmarkId, Sprite>();
      const labelObjects = new Map<LandmarkId, Text>();
      const shadows = new Graphics();
      buildings.addChild(shadows);
      // Load lightweight sprites first; close-up textures are fetched only on demand.
      const textures = await Promise.all(
        LANDMARKS.map((l) => Assets.load(`/campus/v2/${l.id}-low.webp`)),
      );
      if (disposed) return;
      LANDMARKS.forEach((l, i) => {
        shadows
          .ellipse(l.x + 18, l.y - 6, l.width * 0.39, l.width * 0.12)
          .fill({ color: 0x354838, alpha: 0.19 });
        const sprite = new Sprite(textures[i]);
        sprite.anchor.set(0.5, 0.94);
        sprite.position.set(l.x, l.y);
        sprite.width = l.width;
        sprite.scale.y = sprite.scale.x;
        buildings.addChild(sprite);
        sprites.set(l.id, sprite);
        const label = new Text({
          text: l.title,
          style: {
            fontFamily: 'system-ui, sans-serif',
            fontSize: 22,
            fill: 0x334637,
            fontWeight: '600',
            align: 'center',
            stroke: { color: 0xf5f1df, width: 5 },
          },
          resolution: 2,
        });
        label.anchor.set(0.5, 0);
        label.position.set(l.x, l.y + 20);
        labels.addChild(label);
        labelObjects.set(l.id, label);
      });
      let width = 1,
        height = 1,
        fit = 1;
      let camera: Camera = { x: 0, y: 0, zoom: 1 };
      let target = { ...camera };
      let detail: 'world' | 'district' | 'close' = 'world';
      let previousModel = '';
      let closeAssets = false;
      let flashAt = 0;
      let activeEffect = '';
      let effectCount = 0;
      element.dataset.effectCount = '0';
      let elapsed = 0;
      let frames = 0;
      const npc = Array.from({ length: 8 }, (_, i) => {
        const dot = new Graphics()
          .ellipse(0, 6, 5, 2)
          .fill({ color: 0x374b3e, alpha: 0.2 })
          .rect(-2.5, -3, 5, 9)
          .fill([0x677f8f, 0x907463, 0xc1a776][i % 3])
          .circle(0, -6, 3)
          .fill(0xe7ceae);
        particles.addChild(dot);
        return dot;
      });
      const selection = new Graphics();
      decor.addChild(selection);
      const additions = new Graphics();
      decor.addChild(additions);
      function applyModel() {
        const m = live.current.model;
        const stage = landscapeStage(m.completedRounds);
        const signature = `${m.daylight}:${m.player?.mainLevel}:${m.player?.libraryLevel}:${m.selected}:${stage}`;
        if (previousModel !== signature) {
          previousModel = signature;
          ground.tint =
            m.daylight === 'night'
              ? 0x7b88a7
              : m.daylight === 'dusk'
                ? 0xf0c6a4
                : 0xffffff;
          additions.clear();
          for (const l of LANDMARKS) {
            const level = buildingLevel(l.id, m.player);
            const sprite = sprites.get(l.id)!;
            sprite.tint =
              m.daylight === 'night'
                ? 0xb6b5d1
                : m.daylight === 'dusk'
                  ? 0xffdfbd
                  : 0xffffff;
            if (level >= 2)
              additions.roundRect(l.x - 65, l.y - 6, 130, 16, 4).fill(0xf0e5ce);
            if (level >= 3)
              for (const dx of [-88, 88])
                additions
                  .roundRect(l.x + dx - 14, l.y - 5, 28, 15, 4)
                  .fill(0x7b8b66)
                  .circle(l.x + dx - 4, l.y - 7, 4)
                  .fill(0xd4b4a2)
                  .circle(l.x + dx + 6, l.y - 8, 4)
                  .fill(0xe8dbb9);
            if (level >= 4)
              for (const dx of [-108, 108]) {
                additions
                  .rect(l.x + dx - 2, l.y - 37, 4, 40)
                  .fill(0x6e7669)
                  .circle(l.x + dx, l.y - 38, 6)
                  .fill(m.daylight === 'day' ? 0xe9dba9 : 0xffd98d);
                if (m.daylight !== 'day')
                  additions
                    .ellipse(l.x + dx, l.y, 30, 15)
                    .fill({ color: 0xffd98d, alpha: 0.2 });
              }
            if (level >= 5)
              additions
                .moveTo(l.x + 72, l.y - 10)
                .lineTo(l.x + 72, l.y - 72)
                .stroke({ color: 0x99845a, width: 3 })
                .poly([
                  l.x + 74,
                  l.y - 72,
                  l.x + 105,
                  l.y - 63,
                  l.x + 74,
                  l.y - 52,
                ])
                .fill(0x8878a7);
          }
          if (stage >= 1)
            for (let i = 0; i < 12; i++) {
              const x = 480 + i * 56,
                y = 780 + Math.sin(i / 2) * 65;
              additions
                .circle(x, y, 4)
                .fill(m.daylight === 'day' ? 0xb69a68 : 0xffdb8e);
              if (m.daylight !== 'day')
                additions
                  .ellipse(x, y, 19, 9)
                  .fill({ color: 0xffdb8e, alpha: 0.22 });
            }
          if (stage >= 2)
            for (let i = 0; i < 18; i++)
              additions
                .circle(650 + (i % 6) * 55, 890 + Math.floor(i / 6) * 24, 9)
                .fill(i % 2 ? 0xb990aa : 0xf0d2a3);
          if (stage >= 3)
            additions
              .poly([800, 575, 816, 600, 800, 625, 784, 600])
              .fill(0xe5c685)
              .ellipse(800, 644, 28, 12)
              .fill(0xcab783);
        }
        if (m.effect && !effectLedger.has(m.effect.id)) {
          effectLedger.add(m.effect.id);
          activeEffect = m.effect.id;
          element.dataset.effectCount = String(++effectCount);
          flashAt = elapsed;
        }
      }
      const render = () => {
        if (!disposed && initialized) app.render();
      };
      function update() {
        if (disposed) return;
        const m = live.current.model;
        elapsed += app.ticker.deltaMS;
        element.dataset.frameCount = String(++frames);
        const ease = m.reducedMotion ? 1 : Math.min(1, app.ticker.deltaMS / 70);
        camera = {
          x: camera.x + (target.x - camera.x) * ease,
          y: camera.y + (target.y - camera.y) * ease,
          zoom: camera.zoom + (target.zoom - camera.zoom) * ease,
        };
        const scale = fit * camera.zoom;
        root.scale.set(scale);
        root.position.set(
          width / 2 + camera.x - (SCENE.width * scale) / 2,
          height / 2 + camera.y - (SCENE.height * scale) / 2,
        );
        detail = detailAt(camera.zoom, detail);
        element.dataset.detail = detail;
        element.dataset.zoom = camera.zoom.toFixed(2);
        applyModel();
        for (const l of LANDMARKS) {
          const label = labelObjects.get(l.id)!;
          const level = buildingLevel(l.id, m.player);
          label.text =
            detail === 'world'
              ? l.title
              : `${l.title}\n${l.id === 'main' || l.id === 'library' ? `Lv.${level}` : l.id === 'plaza' ? `共建 ${m.completedRounds} 轮` : l.subtitle}`;
          label.scale.set(1 / Math.max(1, camera.zoom * 0.55));
        }
        selection.clear();
        const selected = LANDMARKS.find((l) => l.id === m.selected)!;
        selection
          .ellipse(
            selected.x,
            selected.y + 2,
            selected.width * 0.48,
            selected.width * 0.16,
          )
          .stroke({
            color: m.daylight === 'night' ? 0xffdc94 : 0x697455,
            width: 3,
          });
        if (
          m.effect &&
          activeEffect === m.effect.id &&
          !m.reducedMotion &&
          elapsed - flashAt < 2000
        ) {
          const l = LANDMARKS.find((l) => l.id === m.effect!.landmark)!;
          const t = (elapsed - flashAt) / 2000;
          selection
            .ellipse(l.x, l.y, 35 + t * 120, 16 + t * 50)
            .stroke({ color: 0xe4bf74, width: 6, alpha: 1 - t });
        }
        npc.forEach((n, i) => {
          const t = m.reducedMotion ? i / 8 : (elapsed / 110000 + i / 8) % 1;
          n.position.set(
            220 + t * 1150,
            1020 - Math.sin(t * Math.PI) * 280 + (i % 2) * 15,
          );
          n.visible = detail !== 'world';
        });
        if (detail === 'close' && !closeAssets) {
          closeAssets = true;
          void Promise.all(
            LANDMARKS.map(async (l) => {
              const texture = await Assets.load(`/campus/v2/${l.id}.webp`);
              if (disposed) return;
              const sprite = sprites.get(l.id)!;
              sprite.texture = texture;
              sprite.width = l.width;
              sprite.scale.y = sprite.scale.x;
            }),
          )
            .then(() => {
              if (!disposed) {
                update();
                render();
              }
            })
            .catch(() => {
              if (!disposed) live.current.onError();
            });
        }
      }
      const setTarget = (next: Camera) => {
        target = clampCamera(next, width, height, fit);
        if (live.current.model.reducedMotion) {
          camera = { ...target };
          update();
          render();
        }
      };
      const commands: MapCommands = {
        zoom(factor) {
          setTarget(zoomCamera(target, target.zoom * factor, 0, 0));
        },
        reset() {
          setTarget({ x: 0, y: 0, zoom: 1 });
        },
        focus(id) {
          const l = LANDMARKS.find((l) => l.id === id)!;
          const zoom = 2.4;
          setTarget({
            zoom,
            x: (SCENE.width / 2 - l.x) * fit * zoom,
            y: (SCENE.height / 2 - (l.y - 90)) * fit * zoom,
          });
        },
      };
      observer = new ResizeObserver(() => {
        width = Math.max(1, element.clientWidth);
        height = Math.max(1, element.clientHeight);
        app.renderer.resize(width, height);
        fit = Math.min(width / SCENE.width, height / SCENE.height) * 0.98;
        camera = clampCamera(camera, width, height, fit);
        target = clampCamera(target, width, height, fit);
        update();
        render();
      });
      observer.observe(element);
      const pointers = new Map<number, { x: number; y: number }>();
      let previousPoint = { x: 0, y: 0 },
        origin = { x: 0, y: 0 },
        moved = false,
        pinchDistance = 0;
      const point = (e: PointerEvent) => {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };
      const distance = () => {
        const [a, b] = [...pointers.values()];
        return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
      };
      const down = (e: PointerEvent) => {
        if (e.button !== 0) return;
        canvas.setPointerCapture(e.pointerId);
        const p = point(e);
        pointers.set(e.pointerId, p);
        previousPoint = p;
        origin = p;
        moved = pointers.size > 1;
        pinchDistance = distance();
      };
      const move = (e: PointerEvent) => {
        if (!pointers.has(e.pointerId)) return;
        const p = point(e);
        pointers.set(e.pointerId, p);
        if (pointers.size > 1) {
          moved = true;
          const next = distance();
          const [a, b] = [...pointers.values()];
          if (pinchDistance)
            setTarget(
              zoomCamera(
                target,
                (target.zoom * next) / pinchDistance,
                (a.x + b.x) / 2 - width / 2,
                (a.y + b.y) / 2 - height / 2,
              ),
            );
          pinchDistance = next;
        } else {
          if (Math.hypot(p.x - origin.x, p.y - origin.y) > 6) moved = true;
          if (moved)
            setTarget({
              ...target,
              x: target.x + p.x - previousPoint.x,
              y: target.y + p.y - previousPoint.y,
            });
        }
        previousPoint = p;
      };
      const up = (e: PointerEvent) => {
        const p = point(e);
        if (!moved && pointers.size === 1 && e.type !== 'pointercancel') {
          const x = (p.x - root.x) / root.scale.x,
            y = (p.y - root.y) / root.scale.y;
          const l = [...LANDMARKS]
            .reverse()
            .find(
              (l) =>
                Math.abs(x - l.x) < l.width / 2 &&
                y > l.y - l.width * 0.65 &&
                y < l.y + 65,
            );
          if (l) {
            live.current.onSelect(l.id);
            commands.focus(l.id);
          }
        }
        pointers.delete(e.pointerId);
        pinchDistance = 0;
        const remaining = [...pointers.values()][0];
        if (remaining) {
          previousPoint = remaining;
          origin = remaining;
          moved = true;
        }
      };
      const wheel = (e: WheelEvent) => {
        e.preventDefault();
        const r = canvas.getBoundingClientRect();
        setTarget(
          zoomCamera(
            target,
            target.zoom * Math.exp(-e.deltaY * 0.0015),
            e.clientX - r.left - width / 2,
            e.clientY - r.top - height / 2,
          ),
        );
      };
      const lost = (e: Event) => {
        e.preventDefault();
        live.current.onError();
      };
      const visibility = () => {
        const active = !document.hidden && !live.current.model.reducedMotion;
        element.dataset.running = String(active);
        if (active) app.start();
        else app.stop();
      };
      canvas.addEventListener('pointerdown', down);
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', up);
      canvas.addEventListener('wheel', wheel, { passive: false });
      canvas.addEventListener('webglcontextlost', lost);
      document.addEventListener('visibilitychange', visibility);
      detach = () => {
        canvas.removeEventListener('pointerdown', down);
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up);
        canvas.removeEventListener('pointercancel', up);
        canvas.removeEventListener('wheel', wheel);
        canvas.removeEventListener('webglcontextlost', lost);
        document.removeEventListener('visibilitychange', visibility);
      };
      // Desktop follows the display's animation clock; mobile caps at 30 FPS.
      // Avoid the fractional-ms limiter dropping normal 60 Hz desktop frames.
      app.ticker.maxFPS = matchMedia('(pointer: coarse)').matches ? 30 : 0;
      app.ticker.add(update);
      redraw.current = () => {
        if (disposed) return;
        visibility();
        update();
        render();
      };
      element.dataset.ready = 'true';
      live.current.onReady(commands);
      update();
      visibility();
      render();
    };
    void run().catch(() => {
      if (!disposed) live.current.onError();
    });
    return () => {
      disposed = true;
      redraw.current = () => {};
      observer?.disconnect();
      detach();
      live.current.onReady(null);
      if (initialized && app.renderer) app.destroy(true, { children: true });
    };
  }, [effectLedger]);
  return (
    <div
      ref={host}
      className="campus-pixi-host"
      data-testid="campus-canvas"
      role="img"
      aria-label="可缩放的微缩校园地图；下方地标按钮提供键盘操作"
    />
  );
}
