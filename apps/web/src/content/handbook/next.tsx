import Link from 'next/link';

import { ExtLink, Section, Steps } from '@/components/handbook-blocks';
import { Checklist } from '@/components/handbook-interactive';

export const toc = [
  { id: 'campus', title: '毕业实践：链上邮园' },
  { id: 'paths', title: '接下来学什么' },
  { id: 'real-money', title: '用真钱之前' },
  { id: 'task', title: '自查清单' },
];

export function Body() {
  return (
    <>
      <Section id="campus" title="毕业实践：链上邮园">
        <p>
          链上邮园是本站在 Base Sepolia 上做的一个小游戏。开放期间，左侧导航会显示入口。用它把前面学的串一遍：
        </p>
        <Steps
          items={[
            '用钱包登录本站。（第 7 章）',
            '进入链上邮园，页面会提示你切换到 Base Sepolia。确认钱包里有测试 ETH。（第 4 章）',
            '领取共建者通行证。这是你第一次调用合约，弹窗会显示合约地址和 Gas。',
            '在区块浏览器里找到这笔交易，看 Status 和 To。To 这次是合约地址，不是个人地址。（第 5 章）',
          ]}
        />
        <p>
          玩法细节见 <Link href="/game/learn">链上邮园指南</Link>。
        </p>
      </Section>

      <Section id="paths" title="接下来学什么">
        <ul className="hb-list">
          <li>
            <strong>想写代码：</strong>学 Solidity，用 Foundry 在本地部署合约。可以先读链上邮园的
            <ExtLink href="https://github.com/BUPT3DAO/bupt3dao-web/tree/main/contracts">合约源码</ExtLink>。
          </li>
          <li>
            <strong>想弄懂原理：</strong>
            <ExtLink href="https://ethereum.org/zh/learn/">ethereum.org 的中文学习页</ExtLink>
            讲得比较系统。
          </li>
          <li>
            <strong>想找人一起：</strong>去<Link href="/forum">论坛</Link>发帖，或者参加
            <Link href="/events">活动中心</Link>里的活动。
          </li>
        </ul>
      </Section>

      <Section id="real-money" title="用真钱之前">
        <p>到这里为止，所有练习都在测试网上。将来如果要接触有价值的资产：</p>
        <ul className="hb-list">
          <li>
            先把<Link href="/handbook/safety">第 2 章</Link>再读一遍。
          </li>
          <li>从小额开始。</li>
          <li>金额大了，考虑用硬件钱包。</li>
          <li>了解并遵守当地法律法规。在中国大陆，虚拟货币相关的交易和兑换受到严格限制。</li>
        </ul>
      </Section>

      <Section id="task" title="自查清单">
        <Checklist
          id="next"
          items={['领到了链上邮园通行证', '在区块浏览器里找到了领取交易', '选好了下一步想学的方向']}
        />
      </Section>
    </>
  );
}
