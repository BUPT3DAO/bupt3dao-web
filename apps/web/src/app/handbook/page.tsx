import Link from 'next/link';

import { Icon } from '@/components/icon';
import { ReadMark, ReadProgress } from '@/components/handbook-interactive';
import { HANDBOOK_CHAPTERS, getReadyChapters } from '@/lib/handbook';

export default function HandbookPage() {
  const ready = getReadyChapters();
  const start = ready[0];

  return (
    <div className="hb-page">
      <section className="hb-hero">
        <span className="eyebrow">BUPT3DAO · WEB3 HANDBOOK</span>
        <h1>
          Web3 入门手册<span className="heading-dot">.</span>
        </h1>
        <p>给第一次接触 Web3 的同学。一共 10 章，每章几分钟。练习都在测试网上做，不用花钱。</p>
        <div className="hb-hero-actions">
          {start && (
            <Link href={`/handbook/${start.slug}`} className="btn btn-primary">
              开始阅读 <Icon name="arrow" size={16} />
            </Link>
          )}
          <ReadProgress slugs={HANDBOOK_CHAPTERS.map((chapter) => chapter.slug)} />
        </div>
      </section>

      <ol className="hb-toc-list">
        {HANDBOOK_CHAPTERS.map((chapter) => {
          const inner = (
            <>
              <span className="hb-toc-no">{chapter.no}</span>
              <div>
                <span className="eyebrow">{chapter.eyebrow}</span>
                <h2>{chapter.title}</h2>
                <p>{chapter.summary}</p>
                <small>
                  <span>
                    <Icon name="edit" size={13} />
                    {chapter.task}
                  </span>
                  <span>
                    <Icon name="clock" size={13} />约 {chapter.minutes} 分钟
                  </span>
                </small>
              </div>
              {chapter.ready ? (
                <span className="hb-toc-state">
                  <ReadMark slug={chapter.slug} />
                  <Icon name="chevron" size={18} />
                </span>
              ) : (
                <span className="hb-toc-state is-draft">编写中</span>
              )}
            </>
          );
          return (
            <li key={chapter.slug}>
              {chapter.ready ? (
                <Link className="card hb-toc-item" href={`/handbook/${chapter.slug}`}>
                  {inner}
                </Link>
              ) : (
                <div className="card hb-toc-item is-draft">{inner}</div>
              )}
            </li>
          );
        })}
      </ol>

      <p className="hb-disclaimer">
        本手册只讲工具和原理，不推荐任何币种，不构成投资建议。请遵守当地法律法规。
      </p>
    </div>
  );
}
