import { Callout, ExtLink, Section, Steps, Table, Term } from '@/components/handbook-blocks';
import { Checklist, Quiz } from '@/components/handbook-interactive';

export const toc = [
  { id: 'kinds', title: '三类请求' },
  { id: 'approve', title: '为什么要授权' },
  { id: 'watch', title: '看到这些字要停下' },
  { id: 'login', title: '动手：登录签名' },
  { id: 'revoke', title: '动手：查看和撤销授权' },
  { id: 'task', title: '自查清单' },
  { id: 'quiz', title: '小测验' },
];

export function Body() {
  return (
    <>
      <Section id="kinds" title="三类请求">
        <p>
          <Term k="dapp" />
          要你确认的东西，大致分三类：
        </p>
        <Table
          head={['类型', '用来做什么', '花不花钱', '风险']}
          rows={[
            ['登录签名', '证明你是这个地址的主人', '不上链，免费', '低，确认网址就行'],
            ['交易', '转账、调用合约', '上链，要付 Gas', '看清金额和对象'],
            ['授权', '允许某个合约动用你的代币', 'Approve 要付 Gas；Permit 只是签名，免费', '最高'],
          ]}
        />
      </Section>

      <Section id="approve" title="为什么要授权">
        <p>
          比如在去中心化交易所兑换代币，合约需要从你的地址把代币拿走，所以要先得到你的
          <Term k="approve" />。
        </p>
        <p>
          授权有额度。很多网站默认申请「无限额度」，省得你以后反复授权。可一旦这个合约有漏洞，或者网站本身是假的，你的这种代币就可能被全部转走。钱包允许你改小额度，用多少授权多少更稳妥。
        </p>
      </Section>

      <Section id="watch" title="看到这些字要停下">
        <p>
          最容易中招的是 Permit：它看起来和登录签名差不多，也不花 Gas，但签了就等于授权。弹窗里出现下面这些字时，先停下来弄清楚：
        </p>
        <p>
          <code>Permit</code> <code>Approve</code> <code>setApprovalForAll</code> <code>Spender</code>{' '}
          <code>Unlimited</code>
        </p>
        <Callout tone="danger" title="看不懂就不签">
          正经的网站会让你清楚知道在授权什么。弹窗是一串看不懂的数据时，直接拒绝。
        </Callout>
      </Section>

      <Section id="login" title="动手：登录签名">
        <p>
          如果你已经登录了本站，先退出，再点「连接钱包」重新登录一次。签名之前，把弹窗读一遍：
        </p>
        <Steps
          items={[
            '来源网址和浏览器地址栏一致。',
            '里面有你的地址，还有一句「登录 BUPT3DAO 社区」。',
            '没有金额，没有 Gas。',
          ]}
        />
        <p>确认后登录成功，钱包余额不会有任何变化。</p>
      </Section>

      <Section id="revoke" title="动手：查看和撤销授权">
        <p>
          打开 <ExtLink href="https://revoke.cash">revoke.cash</ExtLink>
          ，连接钱包，选择网络，就能看到这个地址给过哪些授权。不认识或不再用的，点 Revoke 撤销。
        </p>
        <p>撤销本身是一笔交易，要付一点 Gas。新钱包还没授权过任何东西，列表是空的，这很正常。</p>
      </Section>

      <Section id="task" title="自查清单">
        <Checklist
          id="signatures"
          items={['读完弹窗后，用签名登录了本站', '在 revoke.cash 查看过自己的授权']}
        />
      </Section>

      <Section id="quiz" title="小测验">
        <Quiz
          questions={[
            {
              question: '登录本站的签名，会花 Gas 吗？',
              options: ['会', '不会'],
              answer: 1,
              explain: '登录签名不上链，所以不花钱。',
            },
            {
              question: '一个弹窗不要 Gas，内容里有 Permit 和 Spender。它是什么？',
              options: ['普通登录', '授权', '转账'],
              answer: 1,
              explain: 'Permit 是用签名的方式授权，免费但同样危险。',
            },
          ]}
        />
      </Section>
    </>
  );
}
