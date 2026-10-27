import { Compare, Section, Term } from '@/components/handbook-blocks';
import { Quiz } from '@/components/handbook-interactive';

export const toc = [
  { id: 'what', title: '简单说' },
  { id: 'ledger', title: '区块链是什么' },
  { id: 'use', title: '能拿来做什么' },
  { id: 'not', title: '它不是什么' },
  { id: 'quiz', title: '小测验' },
];

export function Body() {
  return (
    <>
      <Section id="what" title="简单说">
        <p>
          Web3 指的是建立在<Term k="blockchain" />
          上的一类应用。你的账户和资产不存在某家公司的服务器上，而是记在一本公开的账本里，由你自己的钥匙控制。
        </p>
        <Compare
          left={{
            label: '常用的 App',
            items: ['账号由平台创建', '平台可以封号、删数据', '数据存在公司服务器上'],
          }}
          right={{
            label: 'Web3 应用',
            items: ['账户是你自己生成的钱包地址', '记录在链上，谁都删不掉', '规则写在合约里，谁都能查'],
          }}
        />
      </Section>

      <Section id="ledger" title="区块链是什么">
        <p>
          想象一本账本，同时保存在世界各地成千上万台电脑上。有人转账，大家核对无误后一起记上一笔。想偷偷改一条旧记录，就得同时改掉大部分电脑上的账本，几乎做不到。
        </p>
        <p>
          比特币是第一条区块链，主要用来转账。以太坊在此基础上加入了<Term k="contract" />
          ，让链上可以运行程序，后来的大多数应用都建在它上面。
        </p>
      </Section>

      <Section id="use" title="能拿来做什么">
        <ul className="hb-list">
          <li>
            <strong>转账：</strong>不经过银行，随时能转，一般几秒到几分钟到账。
          </li>
          <li>
            <strong>登录：</strong>用钱包签名登录网站，不用注册账号密码。本站就是这样登录的。
          </li>
          <li>
            <strong>公开的规则：</strong>投票、游戏这类应用把规则写进合约，谁都能检查，谁也不能私下改。
          </li>
        </ul>
      </Section>

      <Section id="not" title="它不是什么">
        <ul className="hb-list">
          <li>
            <strong>不等于炒币。</strong>币价涨跌只是很小的一部分，本手册不讨论。
          </li>
          <li>
            <strong>不是匿名的。</strong>链上记录全部公开。一个地址一旦和你本人对上，它过去的所有交易都能被查到。
          </li>
          <li>
            <strong>不是没有风险。</strong>没有中间人，出了问题也没人帮你兜底。后面的章节会反复讲这一点。
          </li>
        </ul>
      </Section>

      <Section id="quiz" title="小测验">
        <Quiz
          questions={[
            {
              question: '链上的转账记录，谁能看到？',
              options: ['只有自己', '只有收款人', '所有人', '只有交易所'],
              answer: 2,
              explain: '区块链是公开账本，任何人都能查到每一笔记录。',
            },
            {
              question: '为什么链上的旧记录很难被篡改？',
              options: [
                '有公司在后台审核',
                '账本保存在很多台电脑上，要同时改掉大部分才行',
                '记录都加了密码',
                '法律不允许修改',
              ],
              answer: 1,
              explain: '同一本账本有成千上万份，单独改一份没有用。',
            },
          ]}
        />
      </Section>
    </>
  );
}
