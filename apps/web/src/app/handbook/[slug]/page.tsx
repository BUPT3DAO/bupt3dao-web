import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Icon } from '@/components/icon';
import { ReadToggle } from '@/components/handbook-interactive';
import { CHAPTER_CONTENT } from '@/content/handbook';
import { HANDBOOK_CHAPTERS, getChapter, getNeighbors, getReadyChapters } from '@/lib/handbook';

type Params = Promise<{ slug: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
  return getReadyChapters().map((chapter) => ({ slug: chapter.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const chapter = getChapter((await params).slug);
  if (!chapter) return {};
  return {
    title: chapter.title,
    description: chapter.summary,
    openGraph: { title: `${chapter.title} · Web3 入门手册`, description: chapter.summary },
  };
}

export default async function HandbookChapterPage({ params }: { params: Params }) {
  const { slug } = await params;
  const chapter = getChapter(slug);
  const content = CHAPTER_CONTENT[slug];
  if (!chapter?.ready || !content) notFound();

  const { prev, next } = getNeighbors(slug);
  const upcoming = HANDBOOK_CHAPTERS.find((item) => Number(item.no) === Number(chapter.no) + 1);
  const { Body, toc } = content;

  return (
    <div className="hb-chapter">
      <article className="hb-article">
        <Link href="/handbook" className="text-link hb-back">
          <Icon name="back" size={15} /> 手册目录
        </Link>
        <header className="hb-chapter-head">
          <span className="eyebrow">
            CHAPTER {chapter.no} · {chapter.eyebrow}
          </span>
          <h1>
            {chapter.title}
            <span className="heading-dot">.</span>
          </h1>
          <p>
            <span>
              <Icon name="clock" size={14} /> 约 {chapter.minutes} 分钟
            </span>
            <span>
              <Icon name="edit" size={14} /> {chapter.task}
            </span>
          </p>
        </header>
        <div className="hb-body">
          <Body />
        </div>
        <footer className="hb-chapter-foot">
          <ReadToggle slug={chapter.slug} />
          <nav aria-label="章节翻页">
            {prev && (
              <Link href={`/handbook/${prev.slug}`} className="card">
                <small>上一章</small>
                {prev.title}
              </Link>
            )}
            {next ? (
              <Link href={`/handbook/${next.slug}`} className="card is-next">
                <small>下一章</small>
                {next.title}
              </Link>
            ) : (
              upcoming && (
                <div className="card is-next is-draft">
                  <small>下一章 · 编写中</small>
                  {upcoming.title}
                </div>
              )
            )}
          </nav>
        </footer>
      </article>
      <aside className="hb-aside" aria-label="本章目录">
        <span className="eyebrow">IN THIS CHAPTER</span>
        <ol>
          {toc.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`}>{item.title}</a>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
