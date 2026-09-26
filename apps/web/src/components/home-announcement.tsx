'use client';

import { useState } from 'react';
import { Icon } from '@/components/icon';
import { Markdown } from '@/components/markdown';

const BODY_ID = 'home-announcement-body';

/** 首页首屏顶部的公告条：内容由管理员在后台维护，没配置时整块不渲染。 */
export function HomeAnnouncement({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(true);

  if (!content.trim()) return null;

  return (
    <section className="home-announcement" aria-label="社区公告">
      <button
        type="button"
        className="home-announcement-tag"
        aria-expanded={expanded}
        aria-controls={BODY_ID}
        onClick={() => setExpanded((value) => !value)}
      >
        <Icon name="bell" size={14} />
        公告
        <span className={`home-announcement-caret${expanded ? ' is-open' : ''}`}>
          <Icon name="chevron" size={12} />
        </span>
      </button>
      <div id={BODY_ID} className="home-announcement-panel" hidden={!expanded}>
        <Markdown source={content} className="home-announcement-body" />
      </div>
    </section>
  );
}
