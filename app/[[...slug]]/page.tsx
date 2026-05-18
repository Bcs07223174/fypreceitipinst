'use client';

import dynamic from 'next/dynamic';

const LegacyApp = dynamic(() => import('../../components/AppShell'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-white">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-300 border-t-sky-600" />
    </div>
  ),
});

export default function Page() {
  return <LegacyApp />;
}