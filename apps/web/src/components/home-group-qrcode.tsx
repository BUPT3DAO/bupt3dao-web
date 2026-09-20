'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/icon';
import { api } from '@/lib/api';

/** 首页「加入社区群」区块：二维码由管理员在后台维护，没配置时整块不显示。 */
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
        // 取不到配置就当作没配置，首页不显示这个区块
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!url) return null;

  return (
    <section className="home-qrcode">
      <div className="home-qrcode-text">
        <span className="destination-index">04 / JOIN</span>
        <h2>扫码加入社区群。</h2>
        <p>
          活动通知、组队参赛和日常讨论都在群里。
          <br />
          扫码进来，和同路人打个招呼。
        </p>
      </div>
      <figure className="home-qrcode-figure">
        {/* 二维码是管理员上传的文件，经同源 /uploads 代理返回，不需要 Next 图片优化 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="BUPT3DAO 社区群二维码" />
        <figcaption>
          <Icon name="message" size={14} />
          扫码加入群聊
        </figcaption>
      </figure>
    </section>
  );
}
