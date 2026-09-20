'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/icon';
import { Markdown } from '@/components/markdown';
import { api } from '@/lib/api';

/** 首页首屏顶部的公告条：内容由管理员在后台维护，没配置时整块不渲染。 */
export function HomeAnnouncement() {
  const [content, setContent] = useState('');

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
      <span className="home-announcement-tag">
        <Icon name="bell" size={14} />
        公告
      </span>
      <Markdown source={content} className="home-announcement-body" />
    </section>
  );
}
