'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import type { StoreSettings } from '@/lib/types';

export default function SiteShell({
  settings,
  loggedIn,
  children,
}: {
  settings: StoreSettings | null;
  loggedIn: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // admin tem layout próprio em tela cheia
  if (pathname.startsWith('/admin')) return <>{children}</>;

  return (
    <>
      <Header settings={settings} loggedIn={loggedIn} />
      <main className="mx-auto max-w-5xl px-4 pb-24">{children}</main>
    </>
  );
}
