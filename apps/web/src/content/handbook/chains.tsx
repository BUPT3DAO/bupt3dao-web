import { Callout, Section, Table, Term } from '@/components/handbook-blocks';
import { Quiz } from '@/components/handbook-interactive';

export const toc = [
  { id: 'chains', title: '常见的链' },
  { id: 'l2', title: 'L2 是什么' },
  { id: 'stablecoin', title: '稳定币' },
  { id: 'wrong-network', title: '选错网络会怎样' },
  { id: 'quiz', title: '小测验' },
];

export function Body() {
  return (
    <>
      <Section id="chains" title="常见的链">
        <Table
          head={['链', '原生币', '特点', '地址开头']}
          rows={[
            ['比特币', 'BTC', '最早的区块链，主要用来转账和存储', '1、3 或 bc1'],
            ['以太坊', 'ETH', '支持智能合约，大多数应用建在这里', '0x'],
            ['L2（Base、Arbitrum 等）', '多数用 ETH', '建在以太坊之上，更快更便宜', '0x'],
            ['Solana', 'SOL', '速度快，费用低', '没有固定开头'],
            ['波场 TRON', 'TRX', '很多人用它转 USDT', 'T'],
          ]}
        />
        <p>看地址开头，大致就能判断它属于哪条链。</p>
      </Section>

      <Section id="l2" title="L2 是什么">
        <p>
          以太坊主网很安全，但交易一多就又慢又贵。<Term k="l2" />
          把大量交易放在旁边处理，再把结果汇总写回以太坊。Base 就是一条 L2，前面用的 Base Sepolia
          是它的测试网。
        </p>
        <p>
          以太坊和各条 L2 都用 0x 地址，你的同一个地址在这些链上都能用。但每条链上的余额是分开的：你在 Base
          上有 ETH，不代表在以太坊主网上也有。
        </p>
      </Section>

      <Section id="stablecoin" title="稳定币">
        <p>
          <Term k="stablecoin" />
          的价格和美元 1:1 挂钩，常见的有 USDT 和 USDC。它们由公司发行，公司按 1:1
          持有美元等资产作为支撑，也有权冻结某个地址里的稳定币。
        </p>
        <p>同一种 USDT 同时存在于以太坊、TRON、Solana 等多条链上。不同链上的 USDT 互不相通，不能直接互转。</p>
      </Section>

      <Section id="wrong-network" title="选错网络会怎样">
        <p>转账时，发送和接收必须在同一条链上。</p>
        <p>
          如果对方给的是 T 开头的 TRON 地址，你从以太坊发，地址格式对不上，钱包一般会直接报错，发不出去。
        </p>
        <p>
          麻烦的是两边都是 0x 地址的情况。比如你从 Base 转到对方的以太坊地址，币会到达这个地址在 Base
          上的账户。如果对方是个人钱包，他切到 Base 就能看到；如果对方是交易所，交易所可能不支持这条链，币就很难找回了。
        </p>
        <Callout tone="danger" title="转账前确认三件事">
          币种对不对，网络对不对，地址对不对。
        </Callout>
      </Section>

      <Section id="quiz" title="小测验">
        <Quiz
          questions={[
            {
              question: '一个以 T 开头的地址，最可能属于哪条链？',
              options: ['比特币', '以太坊', 'TRON', 'Base'],
              answer: 2,
              explain: 'TRON 地址以 T 开头，以太坊和 Base 用 0x。',
            },
            {
              question: '你的 0x 地址在 Base 上有 ETH，在以太坊主网上会自动也有吗？',
              options: ['会', '不会，每条链的余额是分开的'],
              answer: 1,
              explain: '地址相同，但余额按链分开记。',
            },
            {
              question: '以太坊上的 USDT 和 TRON 上的 USDT，可以直接互转吗？',
              options: ['可以', '不可以'],
              answer: 1,
              explain: '它们在不同的链上，互不相通。',
            },
          ]}
        />
      </Section>
    </>
  );
}
