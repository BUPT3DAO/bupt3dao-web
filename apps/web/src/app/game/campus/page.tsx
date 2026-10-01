import type { Metadata } from 'next';

import { CampusClient } from '@/components/campus-client';

export const metadata: Metadata = {
  title: '我的链上邮园',
  robots: { index: false, follow: false },
};

export default function CampusPage() {
  return <CampusClient />;
}
