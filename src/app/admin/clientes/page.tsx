'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { brl, formatDateTime } from '@/lib/format';
import { ORDER_STATUS_LABELS, PAYMENT_LABELS, type Order } from '@/lib/types';

type Profile = {
  id: string;
  name: string;
  whatsapp: string | null;
  email: string | null;
  birth_date: string | null;
  role: string;
  created_at: string;
};

type Client = {
  key: string;
  name: string;
  whatsapp: string;
  profile: Profile | null;
  orders: Order[];
  total: number;
  lastOrderAt: string;
  payments: Record<string, number>;
};

type Segment = 'Novo' | 'Recorrente' | 'VIP' | 'Inativo';

const digits = (v: string) => v.replace(/\D/g, '');

function segmentOf(c: Client): Segment {
  const days = (Date.now() - new Date(c.lastOrderAt).getTime()) / 86400000;
  if (days > 30) return 'Inativo';
  if (c.orders.length >= 5 || c.total >= 200) return 'VIP';
  if (c.orders.length === 1) return 'Novo';
  return 'Recorrente';
}

const SEGMENT_STYLE: Record<Segment, string> = {
  Novo: 'bg-blue-100 text-blue-700',
  Recorrente: 'bg-amber-100 text-amber-700',
  VIP: 'bg-purple-100 text-purple-700',
  Inativo: 'bg-neutral-200 text-neutral-500',
};

export default function ClientsAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [segFilter, setSegFilter] = useState<Segment | 'all'>('all');
  const [selected, setSelected] = useState<Client | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: orders }, { data: profiles }] = await Promise.all([
        supabase
          .from('orders')
          .select('*, order_items(*)')
          .order('created_at', { ascending: false })
          .limit(2000),
        supabase.from('profiles').select('*'),
      ]);

      const byUser = new Map<string, Profile>();
      const byPhone = new Map<string, Profile>();
      (profiles ?? []).forEach((p: Profile) => {
        byUser.set(p.id, p);
        if (p.whatsapp) byPhone.set(digits(p.whatsapp), p);
      });

      const map = new Map<string, Client>();
      ((orders ?? []) as Order[]).forEach((o) => {
        const phone = digits(o.customer_whatsapp || '');
        const key = phone || o.user_id || `anon-${o.customer_name}`;
        const existing = map.get(key);
        if (existing) {
          existing.orders.push(o);
          existing.total += Number(o.total);
          const paymentKey = o.payment_method ?? 'pendente';
          existing.payments[paymentKey] = (existing.payments[paymentKey] ?? 0) + 1;
        } else {
          const profile = (o.user_id && byUser.get(o.user_id)) || byPhone.get(phone) || null;
          map.set(key, {
            key,
            name: o.customer_name,
            whatsapp: o.customer_whatsapp,
            profile,
            orders: [o],
            total: Number(o.total),
            lastOrderAt: o.created_at,
            payments: { [o.payment_method ?? 'pendente']: 1 },
          });
        }
      });

      // clientes cadastrados que ainda não pediram
      (profiles ?? []).forEach((p: Profile) => {
        if (p.role === 'admin') return;
        const key = (p.whatsapp && digits(p.whatsapp)) || p.id;
        if (![...map.keys()].includes(key) && !map.has(p.id)) {
          map.set(key, {
            key,
            name: p.name || p.email || 'Sem nome',
            whatsapp: p.whatsapp ?? '',
            profile: p,
            orders: [],
            total: 0,
            lastOrderAt: p.created_at,
            payments: {},
          });
        }
      });

      setClients([...map.values()].sort((a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt)));
      setLoading(false);
    })();
  }, [supabase]);

  const stats = useMemo(() => {
    const withOrders = clients.filter((c) => c.orders.length > 0);
    return {
      total: clients.length,
      vip: withOrders.filter((c) => segmentOf(c) === 'VIP').length,
      inativos: withOrders.filter((c) => segmentOf(c) === 'Inativo').length,
      receita: withOrders.reduce((s, c) => s + c.total, 0),
    };
  }, [clients]);

  const visible = useMemo(() => {
    let list = clients;
    if (segFilter !== 'all') list = list.filter((c) => c.orders.length > 0 && segmentOf(c) === segFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          digits(c.whatsapp).includes(digits(q) || '###') ||
          (c.profile?.email ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [clients, search, segFilter]);

  if (selected) {
    return <ClientDetail client={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="text-xl font-bold">Clientes</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total de clientes" value={String(stats.total)} />
        <StatCard label="VIPs" value={String(stats.vip)} />
        <StatCard label="Inativos (+30d)" value={String(stats.inativos)} />
        <StatCard label="Receita total" value={brl(stats.receita)} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          className="input sm:max-w-xs"
          placeholder="Buscar por nome, WhatsApp ou e-mail"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1.5 overflow-x-auto">
          {(['all', 'Novo', 'Recorrente', 'VIP', 'Inativo'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSegFilter(s)}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold border ${
                segFilter === s ? 'bg-brand text-white border-brand' : 'bg-white border-neutral-300 text-neutral-600'
              }`}
            >
              {s === 'all' ? 'Todos' : s}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-neutral-400 py-8 text-center">Carregando...</p>}
      {!loading && visible.length === 0 && (
        <p className="text-neutral-500 py-8 text-center text-sm">Nenhum cliente encontrado.</p>
      )}

      <div className="card divide-y divide-neutral-100">
        {visible.map((c) => {
          const seg = c.orders.length > 0 ? segmentOf(c) : null;
          return (
            <button
              key={c.key}
              onClick={() => setSelected(c)}
              className="w-full p-4 flex items-center gap-4 text-left hover:bg-neutral-50"
            >
              <div className="h-10 w-10 rounded-full bg-brand/10 text-brand grid place-items-center font-bold shrink-0">
                {(c.name[0] ?? '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">
                  {c.name}{' '}
                  {seg && (
                    <span className={`ml-1 text-[10px] font-bold rounded-full px-2 py-0.5 align-middle ${SEGMENT_STYLE[seg]}`}>
                      {seg}
                    </span>
                  )}
                </p>
                <p className="text-xs text-neutral-500 truncate">
                  {c.whatsapp || 'sem WhatsApp'}
                  {c.profile?.email ? ` · ${c.profile.email}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <p className="font-semibold text-sm">{c.orders.length} pedido{c.orders.length === 1 ? '' : 's'}</p>
                <p className="text-xs text-neutral-500">{brl(c.total)}</p>
              </div>
              <span className="text-neutral-300">→</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
    </div>
  );
}

function ClientDetail({ client, onBack }: { client: Client; onBack: () => void }) {
  const seg = client.orders.length > 0 ? segmentOf(client) : null;
  const ticket = client.orders.length ? client.total / client.orders.length : 0;
  const addresses = useMemo(() => {
    const set = new Map<string, NonNullable<Order['address']>>();
    client.orders.forEach((o) => {
      if (o.address?.street) {
        set.set(`${o.address.street}-${o.address.number}`, o.address);
      }
    });
    return [...set.values()];
  }, [client]);

  return (
    <div className="space-y-4 max-w-4xl">
      <button onClick={onBack} className="text-sm font-semibold text-brand">
        ← Voltar para clientes
      </button>

      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-brand/10 text-brand grid place-items-center font-bold text-xl shrink-0">
            {(client.name[0] ?? '?').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold">
              {client.name}{' '}
              {seg && (
                <span className={`ml-1 text-xs font-bold rounded-full px-2.5 py-1 align-middle ${SEGMENT_STYLE[seg]}`}>
                  {seg}
                </span>
              )}
            </h1>
            <div className="text-sm text-neutral-600 mt-1 space-y-0.5">
              {client.whatsapp && (
                <p>
                  WhatsApp: {client.whatsapp}{' '}
                  <a
                    href={`https://wa.me/55${digits(client.whatsapp)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-green-600 font-semibold"
                  >
                    abrir conversa
                  </a>
                </p>
              )}
              {client.profile?.email && <p>E-mail: {client.profile.email}</p>}
              {client.profile?.birth_date && (
                <p>Nascimento: {new Date(client.profile.birth_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
              )}
              <p className="text-xs text-neutral-400">
                {client.profile ? `Cliente cadastrado desde ${formatDateTime(client.profile.created_at)}` : 'Pedidos sem cadastro (convidado)'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Pedidos" value={String(client.orders.length)} />
        <StatCard label="Total gasto" value={brl(client.total)} />
        <StatCard label="Ticket médio" value={brl(ticket)} />
        <StatCard
          label="Último pedido"
          value={client.orders.length ? formatDateTime(client.lastOrderAt) : '—'}
        />
      </div>

      {Object.keys(client.payments).length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold text-sm mb-2">Meios de pagamento usados</h2>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(client.payments).map(([method, count]) => (
              <span key={method} className="bg-neutral-100 rounded-full px-3 py-1.5 text-sm">
                {PAYMENT_LABELS[method as keyof typeof PAYMENT_LABELS] ?? method} · {count}×
              </span>
            ))}
          </div>
        </div>
      )}

      {addresses.length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold text-sm mb-2">Endereços utilizados</h2>
          <div className="space-y-1 text-sm text-neutral-600">
            {addresses.map((a, i) => (
              <p key={i}>
                {a.street}, {a.number}
                {a.complement ? ` — ${a.complement}` : ''} · {a.neighborhood}
                {a.area ? ` (${a.area})` : ''}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="card divide-y divide-neutral-100">
        <h2 className="font-semibold text-sm p-4 pb-3">Histórico de pedidos</h2>
        {client.orders.length === 0 && (
          <p className="p-4 text-sm text-neutral-500">Nenhum pedido ainda.</p>
        )}
        {client.orders.map((o) => (
          <Link key={o.id} href={`/pedido/${o.id}`} target="_blank" className="block p-4 hover:bg-neutral-50">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm">
                  #{o.code}{' '}
                  <span className="text-xs text-neutral-400 font-normal">{formatDateTime(o.created_at)}</span>
                </p>
                <p className="text-xs text-neutral-500 truncate mt-0.5">
                  {(o.order_items ?? []).map((i) => `${i.quantity}× ${i.product_name}`).join(', ')}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold text-sm">{brl(Number(o.total))}</p>
                <p className="text-xs text-neutral-500">
                  {o.payment_method ? PAYMENT_LABELS[o.payment_method] : 'pagamento pendente'} · {ORDER_STATUS_LABELS[o.status]}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
