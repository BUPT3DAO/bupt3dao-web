import type { Metadata } from 'next';

import { LotteryClient } from '@/components/lottery-client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: '社区抽奖',
  robots: { index: false, follow: false },
};

export default function LotteryPage() {
  return (
    <div className="lottery-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">LUCKY DRAW</span>
          <h1>社区抽奖<span className="heading-dot">.</span></h1>
        </div>
      </div>
      <LotteryClient />
    </div>
  );
}
