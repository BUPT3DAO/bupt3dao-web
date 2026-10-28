import { Section, Term } from '@/components/handbook-blocks';
import { Quiz } from '@/components/handbook-interactive';

export const toc = [
  { id: 'defi', title: 'DeFi' },
  { id: 'swap', title: '看懂兑换界面' },
  { id: 'nft', title: 'NFT' },
  { id: 'pitfalls', title: '常见的坑' },
  { id: 'quiz', title: '小测验' },
];

export function Body() {
  return (
    <>
      <Section id="defi" title="DeFi">
        <p>
          <Term k="defi" />
          是用合约做的金融服务，没有银行，也没有柜台。常见的有三类：
        </p>
        <ul className="hb-list">
          <li>
            <strong>兑换：</strong>在去中心化交易所把一种代币换成另一种。价格由资金池里两种币的数量自动决定。
          </li>
          <li>
            <strong>借贷：</strong>把币抵押进合约，借出另一种币。抵押物跌得太多，合约会自动把它卖掉，这叫清算。
          </li>
          <li>
            <strong>存币生息：</strong>把币存进合约拿收益。收益来自手续费、利息或项目发的奖励币。收益特别高的，风险往往也特别大。
          </li>
        </ul>
      </Section>

      <Section id="swap" title="看懂兑换界面">
        <p>下面是一个兑换界面的示意，数字只是举例：</p>
        <div className="card hb-swap">
          <div className="hb-swap-box">
            <small>支付</small>
            <strong>0.1 ETH</strong>
          </div>
          <div className="hb-swap-box">
            <small>得到（预计）</small>
            <strong>300 USDC</strong>
          </div>
          <div className="hb-swap-row">
            <span>价格</span>
            <b>1 ETH = 3000 USDC</b>
          </div>
          <div className="hb-swap-row">
            <span>最大滑点</span>
            <b>0.5%</b>
          </div>
          <div className="hb-swap-row">
            <span>最少收到</span>
            <b>298.5 USDC</b>
          </div>
          <div className="hb-swap-row">
            <span>网络费用</span>
            <b>约 0.0002 ETH</b>
          </div>
        </div>
        <ul className="hb-list">
          <li>
            <strong>
              <Term k="slippage" />：
            </strong>
            从下单到成交，价格可能会变，这里设的是你最多能接受变多少。
          </li>
          <li>
            <strong>最少收到：</strong>价格变化超出滑点，交易会直接失败，不会让你按更差的价格成交。
          </li>
          <li>
            <strong>网络费用：</strong>就是 Gas。交易失败时，已经消耗的 Gas 也不退。
          </li>
        </ul>
      </Section>

      <Section id="nft" title="NFT">
        <p>
          <Term k="nft" />
          是链上的一条记录，写明某个编号的东西属于哪个地址。它可以代表图片、门票、会员卡或证书。
        </p>
        <p>
          图片本身一般不在链上，链上记的是编号、主人和一个指向图片的链接。链上邮园的通行证也是一种
          NFT，只是设置成了不能转让。
        </p>
      </Section>

      <Section id="pitfalls" title="常见的坑">
        <ul className="hb-list">
          <li>
            <strong>假代币：</strong>任何人都能发一个叫 USDT 的代币。认币要认合约地址，去项目官网或区块浏览器核对。
          </li>
          <li>
            <strong>合约漏洞：</strong>代码有 bug 就可能被盗。审计过的合约也不保证绝对安全。
          </li>
          <li>
            <strong>高收益：</strong>收益越高，越要问一句：这些钱从哪来？
          </li>
          <li>
            <strong>免费 mint：</strong>「免费领 NFT」「白名单」的链接，常常是骗你签 setApprovalForAll。
          </li>
        </ul>
      </Section>

      <Section id="quiz" title="小测验">
        <Quiz
          questions={[
            {
              question: '钱包里出现两个都叫 USDT 的代币，怎么分辨哪个是真的？',
              options: ['看名字', '看图标', '核对合约地址', '看哪个余额多'],
              answer: 2,
              explain: '名字和图标谁都能抄，合约地址抄不了。',
            },
            {
              question: '兑换时价格变化超过了你设的滑点，会怎样？',
              options: ['按新价格成交', '交易失败', '自动退还双倍'],
              answer: 1,
              explain: '超出滑点交易会失败，但已经消耗的 Gas 不退。',
            },
          ]}
        />
      </Section>
    </>
  );
}
