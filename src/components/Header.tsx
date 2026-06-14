'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart';
import { isStoreOpenNow } from '@/lib/storeHours';
import type { StoreSettings } from '@/lib/types';

export default function Header({
  settings,
  loggedIn,
}: {
  settings: StoreSettings | null;
  loggedIn: boolean;
}) {
  const { count } = useCart();
  const [open, setOpen] = useState(() => isStoreOpenNow(settings));

  useEffect(() => {
    setOpen(isStoreOpenNow(settings));
    const interval = setInterval(() => setOpen(isStoreOpenNow(settings)), 60000);
    return () => clearInterval(interval);
  }, [settings]);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 min-w-0">
          {settings?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo_url} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-neutral-100" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-brand text-white grid place-items-center font-bold">
              {settings?.name?.[0] ?? 'D'}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold truncate leading-tight">{settings?.name ?? 'Delivery'}</p>
            <p className={`text-xs font-medium flex items-center gap-1 ${open ? 'text-green-600' : 'text-red-500'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-green-500' : 'bg-red-500'}`} />
              {open ? 'Aberto agora' : 'Fechado'}
            </p>
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href={loggedIn ? '/conta' : '/conta/entrar'}
            className="hidden md:block text-sm font-medium text-neutral-600 hover:text-neutral-900 px-3 py-2"
          >
            {loggedIn ? 'Minha conta' : 'Entrar'}
          </Link>
          <Link
            href={loggedIn ? '/conta' : '/conta/entrar'}
            aria-label="Minha conta"
            className="md:hidden h-10 w-10 rounded-full border border-neutral-200 grid place-items-center text-neutral-600"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </Link>
          <Link
            href="/carrinho"
            className="relative btn-brand !py-2 !px-4 text-sm"
            aria-label="Carrinho"
          >
            <span className="hidden sm:inline">Carrinho</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 sm:hidden">
              <path d="M3 3h2l.4 2M7 13h10l3-7H6.4M7 13L5.4 5M7 13l-2 4h13M9 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" />
            </svg>
            {count > 0 && (
              <span className="absolute -top-2 -right-2 bg-neutral-900 text-white text-xs rounded-full h-5 min-w-5 px-1 grid place-items-center">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
