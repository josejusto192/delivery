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
      <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 min-w-0">
          {settings?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo_url} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-brand text-white grid place-items-center font-bold">
              {settings?.name?.[0] ?? 'D'}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold truncate">{settings?.name ?? 'Delivery'}</p>
            <p className={`text-xs ${open ? 'text-green-600' : 'text-red-500'}`}>
              {open ? '● Aberto agora' : '● Fechado'}
            </p>
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href={loggedIn ? '/conta' : '/conta/entrar'}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900 px-3 py-2"
          >
            {loggedIn ? 'Minha conta' : 'Entrar'}
          </Link>
          <Link
            href="/carrinho"
            className="relative btn-brand !py-2 !px-4 text-sm"
            aria-label="Carrinho"
          >
            Carrinho
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
