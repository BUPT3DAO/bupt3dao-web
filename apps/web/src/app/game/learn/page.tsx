import Link from 'next/link';
import type { Metadata } from 'next';

import { Icon } from '@/components/icon';

export const metadata: Metadata = { title: '链上邮园玩法与合约教学' };

export default function GameLearnPage() {
  return (
    <div className="campus-page campus-learn">
      <div className="page-heading"><div><span className="eyebrow">LEARN BY PLAYING</span><h1>链上邮园指南<span className="heading-dot">.</span></h1><p>从第一次签名，到读懂自己的链上记录。</p></div></div>
      <div className="campus-learn-grid">
        <section className="card campus-learn-step"><span>01 / LOGIN</span><h2>钱包签名登录</h2><p>登录签名证明你控制这个钱包，不会提交交易。首次登录自动创建社区账号。连接后检查地址和当前网络是否正确。</p></section>
        <section className="card campus-learn-step"><span>02 / TESTNET</span><h2>切换 Base Sepolia</h2><p>这是测试网络。操作游戏合约会消耗少量测试 ETH 作为手续费。没有余额时，可从官方水龙头领取。</p><a href="https://docs.base.org/get-started/get-funds" target="_blank" rel="noopener noreferrer" className="text-link">官方测试币说明 <Icon name="upRight" size={14} /></a></section>
        <section className="card campus-learn-step"><span>03 / PASSPORT</span><h2>领取共建者通行证</h2><p>领取会发送第一笔交易。确认后，合约把一张不可转让的通行证记在你的钱包地址下，并赋予初始知识和算力。</p></section>
        <section className="card campus-learn-step"><span>04 / UPGRADE</span><h2>升级建筑</h2><p>西土城主楼产出算力，沙河图书馆产出知识。升级会扣除两种资源，也会提升相应建筑未来的产量；离线收益最多累计 24 小时。</p></section>
        <section className="card campus-learn-step"><span>05 / CO-BUILD</span><h2>参与公共建设</h2><p>在时光广场投入等量的知识与算力。达到本轮目标后，所有成员都会看到新景观，下一轮目标也会开启。</p></section>
        <section className="card campus-learn-step"><span>06 / VERIFY</span><h2>在区块浏览器核对</h2><p>每笔操作都有交易哈希。打开区块浏览器，可以确认发送者、合约地址、交易结果与事件记录。页面提示成功，以链上确认结果为准。</p></section>
      </div>
      <section className="card campus-learn-code"><Icon name="code" size={26} /><div><h2>继续研究合约</h2><p>项目仓库中的 <code>contracts/src/PostCampus.sol</code> 定义资源、升级、公共项目和通行证规则。可以用 Foundry 在本地部署、改动规则并运行测试。</p><a href="https://github.com/BUPT3DAO/bupt3dao-web/tree/main/contracts" target="_blank" rel="noopener noreferrer" className="text-link">查看合约源码 <Icon name="upRight" size={14} /></a></div></section>
      <Link href="/game/campus" className="btn btn-primary">开始建设 <Icon name="arrow" size={16} /></Link>
    </div>
  );
}
