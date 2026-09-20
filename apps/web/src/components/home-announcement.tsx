'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/icon';
import { Markdown } from '@/components/markdown';
import { api } from '@/lib/api';

const BODY_ID = 'home-announcement-body';

/** 首页首屏顶部的公告条：内容由管理员在后台维护，没配置时整块不渲染。 */
export function HomeAnnouncement() {
  const [content, setContent] = useState('');
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .siteConfig()
      .then((config) => {
        if (!cancelled) setContent(config.announcement);
      })
      .catch(() => {
        // 取不到配置就当作没有公告，首屏照常显示
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
