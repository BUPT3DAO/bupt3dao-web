import Link from 'next/link';
import type { Metadata } from 'next';

import { Icon } from '@/components/icon';

export const metadata: Metadata = {
  title: '链上邮园',
  description: '在 BUPT3DAO 的双校区微缩地图里建设建筑、参与共建，体验真正的测试网交易。',
};

export default function GamePage() {
  return (
    <div className="campus-page">
      <section className="campus-hero">
        <div className="campus-hero-copy">
          <span className="eyebrow">BUPT3DAO · ONCHAIN CAMPUS</span>
          <h1>从一座校园，<br />走进链上的世界<span className="heading-dot">.</span></h1>
          <p>建设属于你的北邮主题校园，与伙伴一起点亮公共项目。每次升级与贡献，都会成为测试网上可查证的记录。</p>
          <div className="campus-hero-actions">
            <Link href="/game/campus" className="btn btn-primary">进入链上邮园 <Icon name="arrow" size={17} /></Link>
            <Link href="/game/learn" className="btn btn-ghost">先看看怎么玩</Link>
          </div>
          <span className="campus-hero-note">使用 Base Sepolia 测试网 · 体验用测试币 · 电脑浏览器优先</span>
        </div>
        <div className="campus-hero-art" aria-hidden="true">
          <div className="campus-hero-sun" />
          <div className="campus-hero-block block-back" />
          <div className="campus-hero-block block-front" />
          <span className="campus-hero-art-label">POST CAMPUS / 001</span>
        </div>
      </section>
      <div className="campus-intro-grid">
        <article className="card campus-intro-card"><span>01 / EXPLORE</span><h2>一张熟悉又新鲜的地图</h2><p>西土城主楼、沙河图书馆、时光广场与大龙邮票石雕，组成一座风格化微缩校园。外校伙伴也能从故事里认识北邮。</p></article>
        <article className="card campus-intro-card"><span>02 / BUILD</span><h2>升级自己的校园</h2><p>从知识与算力出发，逐步升级建筑。每个钱包有独立的建设进度，离开后再回来，成长仍保留在链上。</p></article>
        <article className="card campus-intro-card"><span>03 / TOGETHER</span><h2>与成员一起点亮邮园</h2><p>把资源投入全体成员的公共项目，解锁新的广场景观。贡献、完成轮次和个人成就都可以验证。</p></article>
      </div>
      <p className="campus-disclaimer">这是供社区学习的测试网游戏。地图将真实地标和虚构玩法结合；游戏资源没有货币用途。</p>
    </div>
  );
}
