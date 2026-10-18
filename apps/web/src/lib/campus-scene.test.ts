import { describe, expect, it } from 'vitest';
import {
  buildingLevel,
  clampCamera,
  daylightAt,
  detailAt,
  isMobileVisitor,
  landscapeStage,
  mayTransact,
  zoomCamera,
} from './campus-scene';
describe('scene rules', () => {
  it('uses Beijing hours at all daylight boundaries, independent of browser timezone', () => {
    for (const [utc, result] of [
      ['21:59', 'night'],
      ['22:00', 'day'],
      ['08:59', 'day'],
      ['09:00', 'dusk'],
      ['10:59', 'dusk'],
      ['11:00', 'night'],
    ])
      expect(daylightAt('auto', new Date(`2026-10-17T${utc}:00Z`))).toBe(
        result,
      );
    expect(daylightAt('day', new Date('2026-10-17T12:00:00Z'))).toBe('day');
  });
  it('has zoom hysteresis without boundary flicker', () => {
    expect(detailAt(1.2, 'world')).toBe('world');
    expect(detailAt(1.2, 'district')).toBe('district');
    expect(detailAt(2.15, 'district')).toBe('district');
    expect(detailAt(2.15, 'close')).toBe('close');
    expect(detailAt(3, 'world')).toBe('close');
    expect(detailAt(1, 'close')).toBe('world');
  });
  it('clamps camera and keeps the zoom anchor fixed', () => {
    expect(
      clampCamera({ x: 10000, y: -10000, zoom: 9 }, 800, 600, 0.5),
    ).toEqual({ x: 960, y: -720, zoom: 3.4 });
    expect(zoomCamera({ x: 0, y: 0, zoom: 1 }, 2, 100, 100)).toEqual({
      x: -100,
      y: -100,
      zoom: 2,
    });
  });
  it('caps scenery after three rounds without affecting the chain round counter', () => {
    expect([0n, 1n, 2n, 3n, 500n].map(landscapeStage)).toEqual([0, 1, 2, 3, 3]);
    expect(buildingLevel('main', null)).toBe(1);
  });
  it('keeps phones read-only in landscape and checks the transaction boundary', () => {
    expect(isMobileVisitor(932, 'iPhone', true, 5)).toBe(true);
    expect(isMobileVisitor(1440, 'desktop', false, 0)).toBe(false);
    expect(mayTransact(true, true, false, 'idle', false)).toBe(false);
    expect(mayTransact(false, true, false, 'timeout', true)).toBe(false);
    expect(mayTransact(false, true, true, 'idle', false)).toBe(false);
    expect(mayTransact(false, true, false, 'idle', false)).toBe(true);
  });
});
