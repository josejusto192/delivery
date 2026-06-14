'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/lib/cart';
import { brl } from '@/lib/format';

function I({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d={d} />
    </svg>
  );
}

export default function BottomNav({ loggedIn }: { loggedIn: boolean }) {
  const pathname = usePathname();
  const { count, subtotal } = useCart();

  const items = [
    { href: '/', label: 'Início', icon: <I d="M3 11.5L12 4l9 7.5M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9" /> },
    { href: '/conta/pedidos', label: 'Pedidos', icon: <I d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /> },
    {
      href: '/carrinho',
      label: 'Carrinho',
      icon: <I d="M3 3h2l.4 2M7 13h10l3-7H6.4M7 13L5.4 5M7 13l-2 4h13M9 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" />,
      badge: count,
    },
    {
      href: loggedIn ? '/conta' : '/conta/entrar',
      label: 'Conta',
      icon: <I d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
    },
  ];

  return (
    <>
      {/* botão flutuante "ver carrinho" quando há itens, fora da página do carrinho */}
      {count > 0 && pathname !== '/carrinho' && (
        <Link
          href="/carrinho"
          className="md:hidden fixed left-3 right-3 z-40 bg-brand text-white rounded-2xl shadow-lg shadow-brand/30 px-4 py-3 flex items-center justify-between font-semibold text-sm animate-in"
          style={{ bottom: 'calc(4.25rem + env(safe-area-inset-bottom))' }}
        >
          <span className="flex items-center gap-2">
            <span className="bg-white/25 rounded-full h-6 w-6 grid place-items-center text-xs font-bold">{count}</span>
            Ver carrinho
          </span>
          <span>{brl(subtotal)}</span>
        </Link>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-neutral-200 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4">
          {items.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium"
              >
                <span
                  className={`relative flex items-center justify-center h-8 w-14 rounded-full transition-colors ${
                    active ? 'bg-brand/10 text-brand' : 'text-neutral-400'
                  }`}
                >
                  {item.icon}
                  {!!item.badge && (
                    <span className="absolute -top-1 right-2 bg-brand text-white text-[10px] rounded-full h-4 min-w-4 px-1 grid place-items-center">
                      {item.badge}
                    </span>
                  )}
                </span>
                <span className={active ? 'text-brand' : 'text-neutral-500'}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
