// Web3 入门手册的章节目录与术语表。正文在 src/content/handbook 下，按 slug 对应。

export type HandbookChapter = {
  slug: string;
  no: string;
  eyebrow: string;
  title: string;
  summary: string;
  /** 读完这一章能动手完成的事 */
  task: string;
  minutes: number;
  /** 正文写好后改为 true，未写好的章节在目录里显示「编写中」且不生成页面 */
  ready: boolean;
};

export const HANDBOOK_CHAPTERS: HandbookChapter[] = [
  {
    slug: 'what-is-web3',
    no: '00',
    eyebrow: 'WHAT IS WEB3',
    title: 'Web3 是什么',
    summary: '它想解决什么问题，和炒币有什么不同。',
    task: '能用自己的话讲清楚',
    minutes: 5,
    ready: true,
  },
  {
    slug: 'keys',
    no: '01',
    eyebrow: 'KEYS & ADDRESSES',
    title: '地址、私钥和助记词',
    summary: '钱包里存的不是币，而是能动用这些币的钥匙。',
    task: '分清这三样东西',
    minutes: 6,
    ready: true,
  },
  {
    slug: 'safety',
    no: '02',
    eyebrow: 'SAFETY FIRST',
    title: '安全第一课',
    summary: '怎么存助记词，怎么认出骗局，怎么看签名弹窗。',
    task: '完成自查清单',
    minutes: 8,
    ready: true,
  },
  {
    slug: 'wallet',
    no: '03',
    eyebrow: 'YOUR FIRST WALLET',
    title: '装一个钱包',
    summary: '安装浏览器钱包，备份助记词，再试一次恢复。',
    task: '创建钱包并备份',
    minutes: 8,
    ready: true,
  },
  {
    slug: 'testnet',
    no: '04',
    eyebrow: 'TESTNET',
    title: '测试网',
    summary: '测试网上的币不值钱，适合拿来练手。',
    task: '领到测试币',
    minutes: 6,
    ready: true,
  },
  {
    slug: 'first-transaction',
    no: '05',
    eyebrow: 'FIRST TRANSACTION',
    title: '第一笔转账',
    summary: '转一笔测试币，再到区块浏览器里查到它。',
    task: '完成一次转账',
    minutes: 8,
    ready: true,
  },
  {
    slug: 'chains',
    no: '06',
    eyebrow: 'MAP OF CHAINS',
    title: '主流的链和稳定币',
    summary: '比特币、以太坊、L2 和稳定币，以及选错网络会怎样。',
    task: '看懂对比表',
    minutes: 8,
    ready: true,
  },
  {
    slug: 'signatures',
    no: '07',
    eyebrow: 'SIGN & APPROVE',
    title: '签名与授权',
    summary: '登录签名和授权有什么区别，怎么撤销授权。',
    task: '查看自己的授权',
    minutes: 8,
    ready: true,
  },
  {
    slug: 'defi-nft',
    no: '08',
    eyebrow: 'DEFI & NFT',
    title: 'DeFi 与 NFT',
    summary: '基本原理和常见的坑。',
    task: '看懂兑换界面',
    minutes: 10,
    ready: true,
  },
  {
    slug: 'next',
    no: '09',
    eyebrow: 'GRADUATION',
    title: '毕业实践',
    summary: '在链上邮园完成第一次合约交互，再看看接下来学什么。',
    task: '领取链上邮园通行证',
    minutes: 6,
    ready: true,
  },
];

export function getChapter(slug: string): HandbookChapter | undefined {
  return HANDBOOK_CHAPTERS.find((chapter) => chapter.slug === slug);
}

export function getReadyChapters(): HandbookChapter[] {
  return HANDBOOK_CHAPTERS.filter((chapter) => chapter.ready);
}

/** 只在已写好的章节之间翻页 */
export function getNeighbors(slug: string) {
  const ready = getReadyChapters();
  const index = ready.findIndex((chapter) => chapter.slug === slug);
  return {
    prev: index > 0 ? ready[index - 1] : undefined,
    next: index >= 0 && index < ready.length - 1 ? ready[index + 1] : undefined,
  };
}

export const GLOSSARY = {
  address: { term: '地址', en: 'Address', text: '链上账户的「门牌号」，可以公开给别人，用来收款。以太坊地址以 0x 开头，共 42 个字符。' },
  privateKey: { term: '私钥', en: 'Private Key', text: '控制一个地址的唯一钥匙。谁拿到私钥，谁就能动用这个地址里的全部资产。' },
  seed: { term: '助记词', en: 'Seed Phrase', text: '12 或 24 个英文单词，是私钥的「人类可读备份」。用它可以在任何钱包里恢复出你所有的地址。' },
  wallet: { term: '钱包', en: 'Wallet', text: '保管私钥、帮你签名的软件或硬件。币并不存在钱包里，而是记在链上。' },
  signature: { term: '签名', en: 'Signature', text: '用私钥对一段内容盖章，证明「这是我本人同意的」。有的签名只是登录，有的会授权别人动你的资产。' },
  approve: { term: '授权', en: 'Approve', text: '允许某个合约替你转移某种代币。额度可能是「无限」，被恶意合约拿到就能随时转走。' },
  gas: { term: 'Gas', en: 'Gas Fee', text: '在链上执行操作要付的手续费，付给打包交易的节点。' },
  explorer: { term: '区块浏览器', en: 'Block Explorer', text: '查看链上记录的网站，比如 Etherscan。每笔交易的发送方、接收方、结果都能查到。' },
  testnet: { term: '测试网', en: 'Testnet', text: '和主网规则一样、但币没有价值的练习网络，例如 Sepolia、Base Sepolia。' },
  contract: { term: '智能合约', en: 'Smart Contract', text: '部署在链上、按代码自动执行的程序。DApp 的规则就写在合约里。' },
  dapp: { term: 'DApp', en: 'Decentralized App', text: '前端是网页、后端规则写在智能合约里的应用。' },
  hash: { term: '交易哈希', en: 'Tx Hash', text: '每笔交易的唯一编号，以 0x 开头。拿着它可以在区块浏览器里查到这笔交易。' },
  phishing: { term: '钓鱼', en: 'Phishing', text: '仿冒官方网站、账号或消息，骗你输入助记词或签下恶意签名。' },
  airdrop: { term: '空投', en: 'Airdrop', text: '项目方免费向地址发放代币。真空投存在，但「签名领空投」是最常见的骗局入口之一。' },
  siwe: { term: 'SIWE', en: 'Sign-In with Ethereum', text: '用钱包签名代替账号密码登录网站的标准（EIP-4361）。本站登录就用它，只签名、不发交易。' },
  blockchain: { term: '区块链', en: 'Blockchain', text: '一本同时保存在很多台电脑上的公开账本，新记录要大家核对后才写进去，旧记录很难被改。' },
  mainnet: { term: '主网', en: 'Mainnet', text: '正式运行的区块链，上面的币有真实价值。' },
  faucet: { term: '水龙头', en: 'Faucet', text: '免费发放测试币的网站，填上地址就能领一点。' },
  l2: { term: 'L2', en: 'Layer 2', text: '建在以太坊之上的链，交易更快更便宜，最后把结果写回以太坊。Base、Arbitrum、Optimism 都是 L2。' },
  stablecoin: { term: '稳定币', en: 'Stablecoin', text: '价格和美元等法币 1:1 挂钩的代币，比如 USDT、USDC。' },
  defi: { term: 'DeFi', en: 'Decentralized Finance', text: '用智能合约做的金融服务，比如兑换、借贷，没有银行柜台。' },
  nft: { term: 'NFT', en: 'Non-Fungible Token', text: '链上的一条记录，写明某个编号的东西属于哪个地址。每个编号都不一样。' },
  slippage: { term: '滑点', en: 'Slippage', text: '从下单到成交，价格可能变动。滑点设置的是你能接受的最大变动幅度。' },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
