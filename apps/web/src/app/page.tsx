import Link from 'next/link';
import { HomeGroupQrcode } from '@/components/home-group-qrcode';
import { Icon } from '@/components/icon';

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="home-intro">
        <span className="eyebrow">BEIJING UNIVERSITY OF POSTS AND TELECOMMUNICATIONS</span>
        <span className="home-community-label">
          <span className="status-dot" /> BUPT3DAO · 开放的 Web3 社区
        </span>
        <h1>
          从北邮链协出发。
          <br />与<span>同路人</span>，共建未来。
        </h1>
        <p>
          我们因好奇而相遇，以技术和协作连接彼此。
          <br />
          在这里，找到值得交流的想法，也找到一起前行的人。
        </p>
        <div className="home-actions">
          <Link href="/forum" className="btn btn-primary">
            进入社区论坛 <Icon name="arrow" size={18} />
          </Link>
          <Link href="/members" className="btn btn-ghost">
            认识我们的校友 <Icon name="upRight" size={18} />
          </Link>
        </div>
        <div className="home-art" aria-hidden="true">
          <div className="home-ring ring-one" />
          <div className="home-ring ring-two" />
          <div className="home-ring ring-three" />
          <div className="home-art-core">
            <span>3</span>
            <small>BUILD TOGETHER</small>
          </div>
          <span className="home-art-dot" />
          <span className="home-art-coordinate">39.96° N / 116.35° E</span>
        </div>
      </section>
      <div className="home-destinations">
        <Link href="/forum" className="home-destination">
          <span className="destination-index">01 / DISCUSS</span>
          <div>
            <h2>一个好问题，是对话的开始。</h2>
            <Icon name="message" size={24} />
          </div>
          <p>技术探讨、项目共建、校园日常。去论坛，分享你的下一次发现。</p>
          <span className="text-link">
            打开论坛 <Icon name="arrow" size={16} />
          </span>
        </Link>
        <Link href="/members" className="home-destination">
          <span className="destination-index">02 / CONNECT</span>
          <div>
            <h2>认识走在不同路上的伙伴。</h2>
            <Icon name="user" size={24} />
          </div>
          <p>看看历届校友与社团共建者的故事，从他们的主页开始了解。</p>
          <span className="text-link">
            走进校友墙 <Icon name="arrow" size={16} />
          </span>
        </Link>
        <Link href="/articles" className="home-destination">
          <span className="destination-index">03 / WRITE</span>
          <div>
            <h2>把想法写成可以传阅的文字。</h2>
            <Icon name="book" size={24} />
          </div>
          <p>文章墙收录社区成员的 Markdown 长文，从技术笔记到项目复盘。</p>
          <span className="text-link">
            阅读文章墙 <Icon name="arrow" size={16} />
          </span>
        </Link>
      </div>
      <HomeGroupQrcode />
      <footer className="home-footer">
        <span>保持好奇，持续共建。</span>
        <div>
          <Link href="/guide">社区指南</Link>
          <a href="https://x.com/BUPT3DAO" target="_blank" rel="noreferrer">
            @BUPT3DAO <Icon name="upRight" size={13} />
          </a>
        </div>
      </footer>
    </div>
  );
}
