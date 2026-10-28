import { Compare, Flow, Section, Term } from '@/components/handbook-blocks';
import { Quiz } from '@/components/handbook-interactive';

export const toc = [
  { id: 'where', title: '币在哪里' },
  { id: 'address', title: '地址' },
  { id: 'private-key', title: '私钥' },
  { id: 'seed', title: '助记词' },
  { id: 'share', title: '哪些能给别人看' },
  { id: 'quiz', title: '小测验' },
];

export function Body() {
  return (
    <>
      <Section id="where" title="币在哪里">
        <p>
          钱包里显示的余额，并不存在你的手机或电脑里。它记在链上，钱包只是去链上查了一下，再显示给你看。
        </p>
        <p>钱包真正保管的，是能动用这些币的钥匙。这把钥匙有三种形态：</p>
        <Flow
          items={[
            { label: '助记词', sub: '12 或 24 个英文单词' },
            { label: '私钥', sub: '一串 64 位的字符' },
            { label: '地址', sub: '0x 开头，可以公开' },
          ]}
        />
        <p>左边可以算出右边，反过来不行。知道地址，推不出私钥；知道私钥，推不出助记词。</p>
      </Section>

      <Section id="address" title="地址">
        <p>
          <Term k="address" />
          像银行卡号，是给别人转账用的，可以公开。以太坊地址以 0x 开头，一共 42 个字符，比如：
        </p>
        <p>
          <code>0x8f3c2b6e9a71d4c0e5b3f8a2d7c916e04b5ea21c</code>
        </p>
        <p>地址很长，没人记得住。转账时都是复制粘贴，然后核对一遍。</p>
      </Section>

      <Section id="private-key" title="私钥">
        <p>
          <Term k="privateKey" />
          用来给交易签名，证明「这笔转账是地址的主人同意的」。谁有私钥，谁就能动这个地址里的全部资产。
        </p>
        <p>平时你不需要直接接触私钥，钱包会替你保管，替你签名。</p>
      </Section>

      <Section id="seed" title="助记词">
        <p>
          私钥不好抄也容易抄错，所以钱包会给你一组助记词：12 或 24 个常见的英文单词。用它可以算出私钥，再算出地址。
        </p>
        <p>
          同一组助记词能生成很多个地址。钱包里的「账户 1」「账户 2」都来自同一组助记词，备份一次就够了。换手机、换电脑时，输入助记词就能把所有账户恢复出来。
        </p>
      </Section>

      <Section id="share" title="哪些能给别人看">
        <Compare
          left={{ label: '可以给别人', tone: 'good', items: ['地址'] }}
          right={{ label: '不能给任何人', tone: 'bad', items: ['私钥', '助记词'] }}
        />
        <p>
          另外，同一个 0x 地址可以在以太坊、Base 等很多条链上使用，但每条链上的余额是分开的。第 6 章会再讲。
        </p>
      </Section>

      <Section id="quiz" title="小测验">
        <Quiz
          questions={[
            {
              question: '同学要给你转测试币，你应该发给他什么？',
              options: ['助记词', '私钥', '地址', '钱包密码'],
              answer: 2,
              explain: '收款只需要地址，其他三样都不能给别人。',
            },
            {
              question: '钱包里的「账户 1」和「账户 2」，需要分别备份助记词吗？',
              options: ['需要', '不需要，它们来自同一组助记词'],
              answer: 1,
              explain: '同一组助记词可以恢复出所有账户。',
            },
            {
              question: '别人知道了你的地址，能算出你的私钥吗？',
              options: ['能', '不能'],
              answer: 1,
              explain: '只能从私钥算出地址，反过来做不到，所以地址可以放心公开。',
            },
          ]}
        />
      </Section>
    </>
  );
}
