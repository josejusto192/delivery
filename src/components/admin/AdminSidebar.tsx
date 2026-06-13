'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavChild = { label: string; href: string };
type NavItem = {
  label: string;
  href?: string;
  soon?: boolean;
  icon: React.ReactNode;
  children?: NavChild[];
};

function I({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d={d} />
    </svg>
  );
}

const ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: <I d="M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-12h8V3h-8v6z" /> },
  { label: 'Pedidos', href: '/admin', icon: <I d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /> },
  { label: 'PDV', href: '/admin/pdv', icon: <I d="M3 7h18M5 7V5a2 2 0 012-2h10a2 2 0 012 2v2m-1 0v12a2 2 0 01-2 2H8a2 2 0 01-2-2V7m4 5h4" /> },
  {
    label: 'Cardápio',
    icon: <I d="M4 6h16M4 10h16M4 14h10M4 18h10" />,
    children: [
      { label: 'Produtos', href: '/admin/produtos' },
      { label: 'Categorias', href: '/admin/categorias' },
    ],
  },
  { label: 'Clientes', href: '/admin/clientes', icon: <I d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 014-4h2a4 4 0 014 4v2zm0-10a4 4 0 100-8 4 4 0 000 8zm8 1a3 3 0 100-6" /> },
  { label: 'Cupons', href: '/admin/cupons', icon: <I d="M11 5L4 9v6l7 4V5zm0 0l9-3v20l-9-3M4 15v4" /> },
  { label: 'WhatsApp', soon: true, icon: <I d="M21 12a9 9 0 01-13.4 7.8L3 21l1.3-4.5A9 9 0 1121 12zM8.5 9.5c.5 3 3 5.5 6 6l1.5-1.5 2 1-.5 2c-5 .5-9.5-4-9-9l2-.5 1 2-1.5 1.5" /> },
  { label: 'Financeiro', soon: true, icon: <I d="M12 8c-2.2 0-4 .9-4 2s1.8 2 4 2 4 .9 4 2-1.8 2-4 2m0-8c1.7 0 3.2.5 3.8 1.3M12 8V6m0 10c-1.7 0-3.2-.5-3.8-1.3M12 16v2m9-6a9 9 0 11-18 0 9 9 0 0118 0z" /> },
  { label: 'Relatórios', soon: true, icon: <I d="M8 17v-5m4 5V7m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" /> },
  { label: 'Configurações', href: '/admin/configuracoes', icon: <I d="M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 00-2-1.2L14.5 3h-5l-.4 2.6a7.4 7.4 0 00-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 000 2.4l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 002 1.2l.4 2.6h5l.4-2.6a7.4 7.4 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" /> },
];

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate: () => void }) {
  const [open, setOpen] = useState(true);

  if (item.children) {
    const childActive = item.children.some((c) => pathname === c.href);
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            childActive ? 'text-white' : 'text-neutral-300 hover:text-white hover:bg-white/5'
          }`}
        >
          {item.icon}
          <span className="flex-1 text-left">{item.label}</span>
          <span className={`text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {open && (
          <div className="ml-8 mt-0.5 space-y-0.5">
            {item.children.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                onClick={onNavigate}
                className={`block px-4 py-2 rounded-lg text-sm transition-colors ${
                  pathname === c.href
                    ? 'bg-brand text-white font-semibold'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {c.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (item.soon) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-neutral-500 cursor-not-allowed select-none">
        {item.icon}
        <span className="flex-1">{item.label}</span>
        <span className="text-[10px] bg-white/10 rounded px-1.5 py-0.5">em breve</span>
      </div>
    );
  }

  const active = pathname === item.href;
  return (
    <Link
      href={item.href!}
      onClick={onNavigate}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-brand text-white' : 'text-neutral-300 hover:text-white hover:bg-white/5'
      }`}
    >
      {item.icon}
      {item.label}
    </Link>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-3">
        <p className="text-white font-bold text-sm uppercase tracking-wider">Painel da loja</p>
      </div>
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto pb-4">
        {ITEMS.map((item) => (
          <NavLink key={item.label} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="p-3 border-t border-white/10">
        <Link href="/" className="block text-center text-sm text-neutral-300 hover:text-white py-2">
          ← Ver loja
        </Link>
      </div>
    </div>
  );
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const close = () => setMobileOpen(false);

  return (
    <>
      {/* barra superior mobile */}
      <div className="lg:hidden flex items-center gap-3 mb-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="bg-neutral-900 text-white rounded-lg p-2.5"
          aria-label="Abrir menu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="font-bold">Painel da loja</h1>
      </div>

      {/* drawer mobile */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-neutral-900 h-full">
            <SidebarContent pathname={pathname} onNavigate={close} />
          </div>
          <div className="flex-1 bg-black/50" onClick={close} />
        </div>
      )}

      {/* sidebar desktop — altura total */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="bg-neutral-900 sticky top-0 h-screen flex flex-col overflow-hidden">
          <SidebarContent pathname={pathname} onNavigate={() => {}} />
        </div>
      </aside>
    </>
  );
}
