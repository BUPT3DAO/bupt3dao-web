import { Compare, ScamCard, Section, Steps, Term } from '@/components/handbook-blocks';
import { Checklist, Quiz } from '@/components/handbook-interactive';

export const toc = [
  { id: 'why', title: '为什么先讲安全' },
  { id: 'rules', title: '三条规矩' },
  { id: 'seed', title: '助记词怎么存' },
  { id: 'scams', title: '常见骗局' },
  { id: 'read-signature', title: '看懂签名弹窗' },
  { id: 'emergency', title: '出事了怎么办' },
  { id: 'task', title: '自查清单' },
  { id: 'quiz', title: '小测验' },
];

export function Body() {
  return (
    <>
      <Section id="why" title="为什么先讲安全">
        <p>
          银行卡丢了可以挂失，转错账可以找银行。链上不行：没有客服，转出去的钱撤不回来，
          <Term k="seed" />丢了也没人能帮你找回。
        </p>
        <Compare
          left={{
            label: '银行卡',
            items: ['忘了密码，可以去柜台重置', '转错账，可以申请退回', '被盗刷，可以冻结'],
          }}
          right={{
            label: '链上钱包',
            tone: 'bad',
            items: ['助记词丢了，找不回来', '转错地址，退不回来', '被盗走，追不回来'],
          }}
        />
        <p>
          所以先学怎么不丢，再学怎么用。本手册的练习都在<Term k="testnet" />上做，不涉及真钱。
        </p>
      </Section>

      <Section id="rules" title="三条规矩">
        <Steps
          items={[
            <>
              <strong>助记词不给任何人。</strong>
              不管对方说自己是客服、管理员还是学长。本站登录只需要签名，从来不要助记词。
            </>,
            <>
              <strong>看不懂的<Term k="signature">签名</Term>不签。</strong>
              先看弹窗里的网址对不对，再看要你同意什么。
            </>,
            <>
              <strong>第一次转账先转一点试试。</strong>
              到账了再转剩下的。
            </>,
          ]}
        />
      </Section>

      <Section id="seed" title="助记词怎么存">
        <p>助记词是 12 或 24 个英文单词，谁拿到它，谁就能拿走你钱包里的东西。</p>
        <Compare
          left={{
            label: '可以',
            tone: 'good',
            items: ['手抄在纸上，抄完核对一遍', '抄两份，放在不同地方'],
          }}
          right={{
            label: '不要',
            tone: 'bad',
            items: [
              '截图或拍照',
              '发到微信、QQ、邮箱',
              '存在网盘、备忘录、电脑文件里',
              '粘贴到任何网页或聊天框',
            ],
          }}
        />
        <p>相册和备忘录会自动同步到云端，云账号被盗，助记词也就跟着泄露了。</p>
      </Section>

      <Section id="scams" title="常见骗局">
        <div className="hb-scam-grid">
          <ScamCard
            no="01"
            name="假客服"
            story="在群里提问后，有人私聊你，说你的钱包「异常」，让你点链接「验证」。"
            action="管理员不会私聊要东西。直接拉黑。"
          />
          <ScamCard
            no="02"
            name="假网站"
            story="网址和官网只差一两个字母，常出现在搜索广告或私信里。"
            action="常用网站加入收藏夹，只从收藏夹打开。"
          />
          <ScamCard
            no="03"
            name="签名领空投"
            story={
              <>
                网站让你签名「领奖励」，其实签的是<Term k="approve" />，签完对方就能转走你的币。
              </>
            }
            action="弹窗里出现 Approve、Permit、setApprovalForAll 时要格外小心，看不懂就不签。"
          />
          <ScamCard
            no="04"
            name="地址投毒"
            story="骗子用一个首尾和你常用地址很像的地址给你转 0 元，混进你的转账记录。"
            action="不要从转账记录里复制地址，转账前核对完整地址。"
          />
          <ScamCard
            no="05"
            name="来路不明的币"
            story="钱包里突然多了一种币，名字里带网址，让你去「领取」。"
            action="别点，也别卖，在钱包里隐藏掉。"
          />
          <ScamCard
            no="06"
            name="高收益理财"
            story="网友带你在某个平台「稳赚」，一开始能提现，后来要你交各种费用才能取钱。"
            action="保证收益的都是骗局。停止转账，报警。"
          />
        </div>
      </Section>

      <Section id="read-signature" title="看懂签名弹窗">
        <p>每次钱包弹窗，先看两件事：是哪个网站发来的，要你同意什么。</p>
        <div className="hb-sign-pair">
          <figure className="hb-sign is-safe">
            <figcaption>
              <span className="hb-sign-badge">正常</span>本站的登录签名
            </figcaption>
            <div className="hb-sign-window">
              <div className="hb-sign-origin">
                <i>①</i> bupt3dao.club
              </div>
              <div className="hb-sign-kind">签名请求</div>
              <pre>
                {`bupt3dao.club wants you to sign in
with your Ethereum account:
0x8f3C…a21C

`}
                <mark>
                  <i>②</i> 登录 BUPT3DAO 社区
                </mark>
                {`

URI: https://bupt3dao.club
Version: 1
Nonce: 7Kq2Xb…`}
              </pre>
            </div>
            <ol>
              <li>① 网址和地址栏一致</li>
              <li>② 只是登录，不涉及转账</li>
            </ol>
          </figure>
          <figure className="hb-sign is-danger">
            <figcaption>
              <span className="hb-sign-badge">危险</span>假空投网站
            </figcaption>
            <div className="hb-sign-window">
              <div className="hb-sign-origin">
                <i>①</i> claim-bupt3-airdrop.xyz
              </div>
              <div className="hb-sign-kind">setApprovalForAll</div>
              <pre>
                {`Operator: 0x4D1e…77b0
`}
                <mark>
                  <i>②</i> Approved: true
                </mark>
              </pre>
            </div>
            <ol>
              <li>① 陌生网址</li>
              <li>② 允许对方转走你的全部 NFT</li>
            </ol>
          </figure>
        </div>
      </Section>

      <Section id="emergency" title="出事了怎么办">
        <Steps
          items={[
            '新建一个钱包，把旧钱包里剩下的东西马上转过去，旧钱包不再使用。',
            '如果只是签错了授权，到 revoke.cash 撤销它。',
            <>
              记下<Term k="hash" />和对方地址，保存聊天记录。
            </>,
            '报警，或在「国家反诈中心」App 举报。说能帮你追回钱的，多半也是骗子。',
          ]}
        />
      </Section>

      <Section id="task" title="自查清单">
        <Checklist
          id="safety"
          items={[
            '任何人要助记词，我都不给',
            '我把常用网站加进了收藏夹',
            '我的助记词没有截图，也没有存在网上',
            '签名前我会看网址和内容',
            '第一次转账我会先转一点试试',
          ]}
        />
      </Section>

      <Section id="quiz" title="小测验">
        <Quiz
          questions={[
            {
              question: '有人私聊你，自称管理员，说你的钱包出问题了，要你发助记词。怎么办？',
              options: ['发给他', '只发前几个词', '拒绝并拉黑', '先问问朋友'],
              answer: 2,
              explain: '任何情况下都不需要把助记词给别人。',
            },
            {
              question: '助记词怎么存比较安全？',
              options: ['手机截图', '发给自己的微信', '手抄在纸上', '存进网盘'],
              answer: 2,
              explain: '其他几种都会把助记词传到网上。',
            },
            {
              question: '「领空投」网站弹出 setApprovalForAll，这是什么意思？',
              options: ['只是登录', '允许对方转走你的 NFT', '免费领奖励', '付手续费'],
              answer: 1,
              explain: '这是授权，签了对方就能转走整个合集的 NFT。',
            },
          ]}
        />
      </Section>
    </>
  );
}
