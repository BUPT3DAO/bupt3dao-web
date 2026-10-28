'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { LandmarkId } from '@/lib/campus-scene';
const MapView = dynamic(
  () => import('./map-view').then((m) => m.CampusMapView),
  { ssr: false, loading: () => <p role="status">正在展开预览…</p> },
);
export function CampusPublicPreview() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<LandmarkId>('main');
  return (
    <section className="campus-public-preview" id="preview">
      <div className="campus-preview-heading">
        <div>
          <span className="eyebrow">EXPLORE BEFORE YOU BUILD</span>
          <h2>先来校园里走一走。</h2>
          <p>
            公开静态示例，不读取钱包与个人进度。电脑和手机都能拖动、缩放探索。
          </p>
        </div>
        <button
          className="btn btn-ghost"
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '收起校园预览' : '预览微缩校园'}
        </button>
      </div>
      {open && (
        <MapView
          preview
          player={null}
          selected={selected}
          onSelect={setSelected}
          completedRounds={3n}
        />
      )}
    </section>
  );
}
