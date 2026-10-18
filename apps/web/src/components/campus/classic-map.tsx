'use client';

import { LANDMARKS, type LandmarkId } from '@/lib/campus-scene';
import type { CampusPlayer } from '@/lib/campus';

type Location = LandmarkId;
const LOCATIONS = LANDMARKS.map((item) => ({
  ...item,
  x: `${item.x / 16}%`,
  y: `${item.y / 12}%`,
}));

function Structure({ kind }: { kind: Location }) {
  return (
    <svg
      className={`campus-structure campus-structure-${kind}`}
      viewBox="0 0 180 132"
      aria-hidden="true"
    >
      <ellipse cx="90" cy="114" rx="75" ry="14" fill="rgba(22,24,65,.25)" />
      <path d="M23 81 89 45 159 81 91 119Z" fill="var(--tile-ground)" />
      {kind === 'plaza' ? (
        <>
          <path d="M41 79 91 53 140 79 91 105Z" fill="#d1c4a7" />
          <path d="M91 65v27" stroke="#fff7db" strokeWidth="4" />
          <circle cx="91" cy="61" r="12" fill="var(--roof)" />
          <path d="m34 74 15-8 15 8-15 8Z" fill="#7aaa83" />
          <path d="m121 80 14-8 14 8-14 8Z" fill="#7aaa83" />
        </>
      ) : kind === 'sculpture' ? (
        <>
          <path
            d="M43 68 90 42 141 70 91 99Z"
            fill="#d8b198"
            stroke="#b38f78"
            strokeWidth="2"
          />
          <path
            d="M54 68 90 49 130 70 91 91Z"
            fill="none"
            stroke="#f6dec1"
            strokeWidth="3"
          />
          <path
            d="M73 70q25-24 36-5t-26 11q-15-6 10-18"
            fill="none"
            stroke="#98765d"
            strokeWidth="4"
          />
        </>
      ) : (
        <>
          <path
            d="M44 54 91 29 139 54 139 91 91 117 44 91Z"
            fill="var(--wall)"
          />
          <path d="M44 54 91 29 139 54 91 81Z" fill="var(--roof)" />
          <path d="M44 54 91 81 91 117 44 91Z" fill="var(--side)" />
          <path
            d="M56 69 67 75v18L56 87Z M72 78l11 6v18l-11-6Z"
            fill="var(--window)"
          />
          <path
            d="m100 84 12-7v18l-12 7Z m19-11 11-6v18l-11 7Z"
            fill="var(--window)"
          />
          {kind === 'library' && (
            <path d="M60 43 91 26 121 43 91 60Z" fill="#f8e6c1" />
          )}
          {kind === 'lab' && (
            <path d="M87 29V12m-9 8h18" stroke="#d5eeff" strokeWidth="4" />
          )}
          {kind === 'main' && (
            <path d="M91 29V12m-12 0h24" stroke="#fbe3a0" strokeWidth="4" />
          )}
        </>
      )}
    </svg>
  );
}

export function ClassicCampusMap({
  selected,
  onSelect,
  player,
  completedRounds,
}: {
  selected: Location;
  onSelect: (location: Location) => void;
  player: CampusPlayer | null;
  completedRounds: bigint;
}) {
  return (
    <div
      className={`campus-map ${completedRounds > 0n ? 'campus-map-lit' : ''}`}
      aria-label="链上邮园地图"
    >
      <span className="campus-map-sun" aria-hidden="true" />
      <svg
        className="campus-map-paths"
        viewBox="0 0 1000 620"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M210 185Q330 280 490 395T755 195 M495 390Q405 455 205 505 M495 390Q640 515 825 480"
          fill="none"
          stroke="#e4d9bd"
          strokeWidth="36"
          strokeLinecap="round"
        />
        <path
          d="M210 185Q330 280 490 395T755 195 M495 390Q405 455 205 505 M495 390Q640 515 825 480"
          fill="none"
          stroke="#f6eedb"
          strokeWidth="27"
          strokeLinecap="round"
          strokeDasharray="6 22"
        />
      </svg>
      <span className="campus-map-mark mark-one" aria-hidden="true">
        ✦
      </span>
      <span className="campus-map-mark mark-two" aria-hidden="true">
        ✦
      </span>
      <span className="campus-map-mark mark-three" aria-hidden="true">
        ✧
      </span>
      {completedRounds > 0n && (
        <span className="campus-map-beacon" aria-hidden="true">
          ✦
        </span>
      )}
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
          <span className="campus-location-name">
            {location.title}
            <small>
              {location.id === 'main'
                ? `Lv.${player?.mainLevel ?? 1}`
                : location.id === 'library'
                  ? `Lv.${player?.libraryLevel ?? 1}`
                  : location.id === 'plaza'
                    ? `已完成 ${completedRounds} 轮`
                    : location.subtitle}
            </small>
          </span>
        </button>
      ))}
      <span className="campus-map-label">BUPT3DAO · 校园共建计划</span>
    </div>
  );
}
