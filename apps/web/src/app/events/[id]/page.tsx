'use client';

import { useParams } from 'next/navigation';

import { EventDetailClient } from '@/components/event-detail-client';

export default function EventPage() {
  const params = useParams<{ id: string }>();
  return <div className="events-page"><EventDetailClient eventId={Number(params.id)} /></div>;
}
