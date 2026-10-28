import { Section, Steps, Table, Term } from '@/components/handbook-blocks';
import { Checklist, Quiz } from '@/components/handbook-interactive';

export const toc = [
  { id: 'prepare', title: '准备' },
  { id: 'send', title: '发送' },
  { id: 'gas', title: 'Gas 是什么' },
  { id: 'explorer', title: '在区块浏览器里查' },
  { id: 'task', title: '自查清单' },
  { id: 'quiz', title: '小测验' },
];

export function Body() {
  return (
    <>
      <Section id="prepare" title="准备">
        <p>
          在钱包的账户菜单里新建一个「账户 2」，它和账户 1 来自同一组助记词。我们从账户 1 给账户 2
          转一点测试 ETH，转错了也没关系，都是你自己的。
        </p>
      </Section>

      <Section id="send" title="发送">
        <Steps
          items={[
            '确认当前网络是 Base Sepolia。',
            '切到账户 2，复制它的地址。',
            '切回账户 1，点「发送」。',
            '粘贴账户 2 的地址，核对开头和结尾。',
            '金额填 0.001。',
            '确认页会显示预计的网络费用，看一眼，点确认。',
          ]}
        />
        <p>几秒钟后，账户 2 就能看到这笔钱。</p>
      </Section>

      <Section id="gas" title="Gas 是什么">
        <p>
          在链上做任何改动都要付手续费，叫
          <Term k="gas" />。这笔钱付给处理交易的网络，不给钱包，也不给网站。
        </p>
        <p>
          Gas 用这条链自己的币来付，在 Base Sepolia 上是测试 ETH。所以就算你只想转别的代币，钱包里也得留一点
          ETH。网络繁忙时，Gas 会变贵。
        </p>
      </Section>

      <Section id="explorer" title="在区块浏览器里查">
        <p>
          钱包的「活动」列表里会出现这笔交易。点开它，选「在区块浏览器上查看」，会打开
          sepolia.basescan.org。这就是<Term k="explorer" />，主要看这几项：
        </p>
        <Table
          head={['页面上的字段', '意思']}
          rows={[
            ['Transaction Hash', '这笔交易的编号'],
            ['Status', 'Success 表示成功；Pending 表示还在排队'],
            ['From', '发送方地址'],
            ['To', '接收方地址'],
            ['Value', '转了多少'],
            ['Transaction Fee', '付了多少手续费'],
          ]}
        />
        <p>显示 Success 之后，这笔交易就撤不回来了。</p>
      </Section>

      <Section id="task" title="自查清单">
        <Checklist
          id="first-transaction"
          items={['新建了账户 2', '从账户 1 转了 0.001 测试 ETH 到账户 2', '在区块浏览器里找到了这笔交易']}
        />
      </Section>

      <Section id="quiz" title="小测验">
        <Quiz
          questions={[
            {
              question: '钱包里只有 USDT，没有 ETH，能把 USDT 转出去吗？',
              options: ['能', '不能，付不了 Gas'],
              answer: 1,
              explain: '在以太坊和 Base 上，Gas 要用 ETH 付。',
            },
            {
              question: '区块浏览器显示 Success 后，还能撤回吗？',
              options: ['能，联系客服', '能，24 小时内', '不能'],
              answer: 2,
              explain: '链上交易确认后无法撤回，所以转账前要核对地址。',
            },
          ]}
        />
      </Section>
    </>
  );
}
