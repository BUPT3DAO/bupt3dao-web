import { Callout, ExtLink, Section, Steps, Table, Term } from '@/components/handbook-blocks';
import { Checklist, Quiz } from '@/components/handbook-interactive';

export const toc = [
  { id: 'what', title: '测试网是什么' },
  { id: 'add', title: '添加 Base Sepolia' },
  { id: 'faucet', title: '领测试币' },
  { id: 'task', title: '自查清单' },
  { id: 'quiz', title: '小测验' },
];

export function Body() {
  return (
    <>
      <Section id="what" title="测试网是什么">
        <p>
          <Term k="mainnet" />是正式运行的链，上面的币有价值。<Term k="testnet" />
          的规则和主网一样，但币是免费领的，没有价值。开发者在测试网上调试程序，新手正好拿来练手。
        </p>
        <p>
          常见的测试网有 Sepolia（以太坊的测试网）和 Base Sepolia（Base 的测试网）。本站的链上邮园用的是 Base
          Sepolia，本手册也用它。
        </p>
      </Section>

      <Section id="add" title="添加 Base Sepolia">
        <p>
          很多网站会在你连接钱包时提示切换网络，点同意就行。也可以手动添加：打开钱包的网络菜单，选「添加网络」，再选「手动添加」，填写下面这些信息：
        </p>
        <Table
          head={['项目', '填写']}
          rows={[
            ['网络名称', 'Base Sepolia'],
            ['RPC URL', <code key="rpc">https://sepolia.base.org</code>],
            ['链 ID', <code key="id">84532</code>],
            ['货币符号', 'ETH'],
            ['区块浏览器', <code key="explorer">https://sepolia.basescan.org</code>],
          ]}
        />
        <Callout tone="tip" title="练习前看一眼网络">
          钱包会显示当前所在的网络。每次练习前确认是 Base Sepolia，不要在主网上操作。
        </Callout>
      </Section>

      <Section id="faucet" title="领测试币">
        <p>
          测试网上的 ETH 要从<Term k="faucet" />领。Base 官方文档列出了几个可用的水龙头：
          <ExtLink href="https://docs.base.org/get-started/get-funds">Base 测试币说明</ExtLink>。
        </p>
        <Steps
          items={[
            '在钱包里点一下地址，就复制好了。',
            '打开水龙头页面，选 Base Sepolia，粘贴地址，领取。',
            '等几十秒，在钱包里切到 Base Sepolia，就能看到余额。',
          ]}
        />
        <p>
          有的水龙头要求登录，或者要求你的地址在主网上有少量余额。领不到的话，可以在论坛或社区群里请同学转一点。
        </p>
        <Callout tone="danger" title="测试币不值钱">
          有人要你花钱买测试币，或者说测试币能换成真钱，都不要信。
        </Callout>
      </Section>

      <Section id="task" title="自查清单">
        <Checklist
          id="testnet"
          items={['钱包里添加了 Base Sepolia', '领到了测试 ETH', '知道怎么看当前所在的网络']}
        />
      </Section>

      <Section id="quiz" title="小测验">
        <Quiz
          questions={[
            {
              question: '测试网上的 ETH 值多少钱？',
              options: ['和主网一样', '主网的一半', '没有价值', '看行情'],
              answer: 2,
              explain: '测试币免费领取，只用来练习和测试。',
            },
            {
              question: '开始练习前，首先要确认什么？',
              options: ['币价', '钱包当前的网络', '电脑电量', '浏览器版本'],
              answer: 1,
              explain: '确认在 Base Sepolia 上，才不会误用主网资产。',
            },
          ]}
        />
      </Section>
    </>
  );
}
