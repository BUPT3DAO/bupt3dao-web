import type { Metadata } from 'next';

import { MyEventsClient } from '@/components/my-events-client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '我的活动', robots: { index: false, follow: false } };

export default function MyEventsPage() {
  return <div className="events-page"><div className="page-heading"><div><span className="eyebrow">YOUR EVENTS</span><h1>我的活动<span className="heading-dot">.</span></h1><p>管理关注的活动和站内开场提醒。</p></div></div><MyEventsClient /></div>;
}
