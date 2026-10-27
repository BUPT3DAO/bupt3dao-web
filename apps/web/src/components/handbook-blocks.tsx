import type { ReactNode } from 'react';

import { Icon, type IconName } from '@/components/icon';
import { GLOSSARY, type GlossaryKey } from '@/lib/handbook';

// 入门手册正文用到的排版积木，全部是服务端组件；需要交互的放在 handbook-interactive.tsx

/** 术语：悬停或点按显示解释，手机上从底部弹出 */
export function Term({ k, children }: { k: GlossaryKey; children?: ReactNode }) {
  const entry = GLOSSARY[k];
  return (
    <span className="hb-term" tabIndex={0}>
      {children ?? entry.term}
      <span className="hb-term-tip" role="tooltip">
        <b>
          {entry.term} <small>{entry.en}</small>
        </b>
        {entry.text}
      </span>
    </span>
  );
}

const CALLOUT_ICONS: Record<CalloutTone, IconName> = {
  key: 'spark',
  danger: 'shield',
  tip: 'check',
  task: 'edit',
};

type CalloutTone = 'key' | 'danger' | 'tip' | 'task';

export function Callout({
  tone,
  title,
  children,
}: {
  tone: CalloutTone;
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className={`hb-callout hb-callout-${tone}`}>
      <Icon name={CALLOUT_ICONS[tone]} size={18} />
      <div>
        <strong>{title}</strong>
        <div className="hb-callout-body">{children}</div>
      </div>
    </aside>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="hb-section" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/** 两列对照，比如「银行 vs 区块链」「该做 vs 别做」 */
export function Compare({
  left,
  right,
}: {
  left: { label: string; tone?: 'good' | 'bad' | 'plain'; items: ReactNode[] };
  right: { label: string; tone?: 'good' | 'bad' | 'plain'; items: ReactNode[] };
}) {
  return (
    <div className="hb-compare">
      {[left, right].map((side) => (
        <div key={side.label} className={`hb-compare-side is-${side.tone ?? 'plain'}`}>
          <span>{side.label}</span>
          <ul>
            {side.items.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** 骗局卡片：套路和怎么办 */
export function ScamCard({
  no,
  name,
  story,
  action,
}: {
  no: string;
  name: string;
  story: ReactNode;
  action: ReactNode;
}) {
  return (
    <article className="card hb-scam">
      <header>
        <span>{no}</span>
        <h3>{name}</h3>
      </header>
      <p>{story}</p>
      <p className="hb-scam-action">
        <b>怎么办：</b>
        {action}
      </p>
    </article>
  );
}

export function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="hb-steps">
      {items.map((item, index) => (
        <li key={index}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <div>{item}</div>
        </li>
      ))}
    </ol>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="hb-table">
      <table>
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 从左到右的推导关系，手机上改为从上到下 */
export function Flow({ items }: { items: { label: string; sub: ReactNode }[] }) {
  return (
    <div className="hb-flow">
      {items.map((item, index) => (
        <div key={item.label} className="hb-flow-step">
          {index > 0 && <Icon name="arrow" size={18} />}
          <div className="card">
            <strong>{item.label}</strong>
            <span>{item.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
