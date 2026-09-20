'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/** 首页首屏的社区群二维码卡片：二维码由管理员在后台维护，没配置时整块不显示。 */
export function HomeGroupQrcode() {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .siteConfig()
      .then((config) => {
        if (!cancelled) setUrl(config.group_qrcode_url);
      })
      .catch(() => {
        // 取不到配置就当作没配置，首屏不显示这张卡片
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!url) return null;

  return (
    <section className="home-qrcode-card">
      <span className="home-qrcode-tag">JOIN THE GROUP</span>
      <figure className="home-qrcode-figure">
        {/* 二维码是管理员上传的文件，经同源 /uploads 代理返回，不需要 Next 图片优化 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="BUPT3DAO 社区群二维码" />
      </figure>
      <h2>扫码加入社区群</h2>
      <p>活动通知、组队参赛与日常讨论都在群里。</p>
    </section>
  );
}
