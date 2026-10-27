import { Callout, Section, Steps, Table } from '@/components/handbook-blocks';
import { Checklist, Quiz } from '@/components/handbook-interactive';

export const toc = [
  { id: 'types', title: '三种「钱包」' },
  { id: 'install', title: '安装' },
  { id: 'create', title: '创建钱包' },
  { id: 'restore', title: '试一次恢复' },
  { id: 'login', title: '登录本站' },
  { id: 'task', title: '自查清单' },
  { id: 'quiz', title: '小测验' },
];

export function Body() {
  return (
    <>
      <Section id="types" title="三种「钱包」">
        <Table
          head={['类型', '谁保管私钥', '适合']}
          rows={[
            ['交易所账户', '交易所。用账号密码登录，忘了能找回，但交易所可以冻结账户', '—'],
            ['插件 / 手机钱包', '你自己，靠助记词', '入门和日常使用'],
            ['硬件钱包', '你自己。私钥存在一个不联网的小设备里', '金额较大时'],
          ]}
        />
        <p>
          本手册用浏览器插件钱包。本站支持 MetaMask、OKX Wallet、Bitget Wallet、TokenPocket、Rabby
          等，下面以 MetaMask 为例，其他钱包的步骤差不多。
        </p>
      </Section>

      <Section id="install" title="安装">
        <Steps
          items={[
            '从钱包官网（例如 metamask.io）给出的链接安装。搜索结果里的广告可能是假钱包。',
            '装好后，点浏览器右上角的拼图图标，把钱包固定到工具栏，方便以后打开。',
          ]}
        />
      </Section>

      <Section id="create" title="创建钱包">
        <Steps
          items={[
            '打开钱包，选「创建新钱包」。如果有用邮箱或社交账号创建的选项，本手册统一用助记词方式。',
            '设置一个密码。',
            '钱包显示助记词。确认周围没人、没在录屏，然后用笔抄在纸上，不要截图。',
            '按顺序点选单词，确认你抄对了。',
            '完成。钱包首页会显示你的 0x 地址。',
          ]}
        />
        <Callout tone="key" title="密码和助记词不是一回事">
          密码只用来解锁这台电脑上的钱包，忘了可以用助记词重新导入。助记词才是真正的钥匙，丢了就找不回来。
        </Callout>
      </Section>

      <Section id="restore" title="试一次恢复">
        <p>趁钱包里还没有东西，试一次恢复，确认纸上的助记词没抄错。</p>
        <Steps
          items={[
            '记下现在地址的前 6 位和后 4 位。',
            '换一个浏览器装上同一个钱包，选「导入已有钱包」。',
            '输入纸上的助记词，再设一个密码。',
            '如果显示的地址和刚才一样，说明抄对了。不一样就回去检查拼写和顺序。',
          ]}
        />
      </Section>

      <Section id="login" title="登录本站">
        <p>
          点页面右上角的「连接钱包」，选你的钱包，在弹窗里确认签名，就登录了。这只是一次签名，不花钱。第 7 章会细讲这个弹窗。
        </p>
      </Section>

      <Section id="task" title="自查清单">
        <Checklist
          id="wallet"
          items={[
            '钱包是从官网链接安装的',
            '助记词抄在纸上，没有截图',
            '恢复后的地址和原来一样',
            '用钱包登录了本站',
          ]}
        />
      </Section>

      <Section id="quiz" title="小测验">
        <Quiz
          questions={[
            {
              question: '忘了钱包密码，怎么办？',
              options: ['联系钱包客服重置', '用助记词重新导入，设新密码', '钱就没了', '换个钱包就行'],
              answer: 1,
              explain: '密码只管这台设备，有助记词就能重新导入。',
            },
            {
              question: '交易所账户和自己的钱包，最大的区别是什么？',
              options: ['界面不一样', '谁保管私钥', '能存的币种不一样', '没有区别'],
              answer: 1,
              explain: '交易所账户的私钥在交易所手里，自己的钱包私钥在你手里。',
            },
          ]}
        />
      </Section>
    </>
  );
}
