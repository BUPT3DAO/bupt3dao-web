import type { Metadata } from 'next';

import { EventsClient } from '@/components/events-client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: '社区活动',
  robots: { index: false, follow: false },
};

export default function EventsPage() {
  return (
    <div className="events-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MEET & BUILD TOGETHER</span>
          <h1>社区活动<span className="heading-dot">.</span></h1>
          <p>参加下一场交流，也把每次相遇留下的收获带回社区。</p>
        </div>
      </div>
      <EventsClient />
    </div>
  );
}
