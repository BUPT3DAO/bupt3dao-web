import Link from 'next/link';
import { Icon } from '@/components/icon';

export default function GuidePage() {
  return (
    <div className="guide-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR FIRST STEPS</span>
          <h1>
            社区指南<span className="heading-dot">.</span>
          </h1>
          <p>从认识这里，到找到同行的伙伴。</p>
        </div>
      </div>
      <div className="guide-steps">
        <section className="card guide-step">
          <span>01</span>
          <div>
            <h2>一个钱包，就是你的社区身份</h2>
            <p>
              点击连接钱包，通过浏览器钱包签名登录。首次登录会自动创建个人主页，无需交易和 Gas
              费。请核对签名中的域名，绝不向任何人透露私钥或助记词。
            </p>
          </div>
          <Icon name="wallet" size={24} />
        </section>
        <section className="card guide-step">
          <span>02</span>
          <div>
            <h2>让伙伴们认识你</h2>
            <p>
              上传头像，设置昵称，写下你的兴趣、研究方向或正在构建的项目。资料将展示在你的公开主页。
            </p>
            <Link className="text-link" href="/settings">
              编辑个人资料 <Icon name="arrow" size={16} />
            </Link>
          </div>
          <Icon name="user" size={24} />
        </section>
        <section className="card guide-step">
          <span>03</span>
          <div>
            <h2>去论坛，开启一次对话</h2>
            <p>
              分享技术心得、寻找项目伙伴，或记录校园日常。发帖时添加 #技术交流、#项目共建、#校园日常
              标签，方便其他伙伴找到讨论。
            </p>
            <Link className="text-link" href="/forum">
              进入论坛 <Icon name="arrow" size={16} />
            </Link>
          </div>
          <Icon name="message" size={24} />
        </section>
        <section className="card guide-step">
          <span>04</span>
          <div>
            <h2>认识我们的校友与共建者</h2>
            <p>
              校友墙由管理员从已注册成员中精选，展示届别、介绍和个人主页。希望参与展示的校友，可以通过官方账号联系社团。
            </p>
            <Link className="text-link" href="/members">
              查看校友墙 <Icon name="arrow" size={16} />
            </Link>
          </div>
          <Icon name="spark" size={24} />
        </section>
      </div>
      <div className="guide-code">
        <Icon name="shield" size={24} />
        <div>
          <h2>自由表达，也彼此尊重。</h2>
          <p>
            不发布垃圾广告、欺诈链接、隐私信息或人身攻击。管理员可以删除违规帖子、封禁违规账号；封禁期间该用户的公开内容会被隐藏。
          </p>
        </div>
      </div>
    </div>
  );
}
