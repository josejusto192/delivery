'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { brl } from '@/lib/format';
import { PAYMENT_LABELS, type Order } from '@/lib/types';
import { PERIOD_OPTIONS, rangeFor, startOfDay, toInputDate, type Period } from '@/lib/period';

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? '');
          return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(';')
    )
    .join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RelatoriosPage() {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('week');
  const [customFrom, setCustomFrom] = useState(toInputDate(new Date()));
  const [customTo, setCustomTo] = useState(toInputDate(new Date()));

  useEffect(() => {
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(5000);
      setOrders((data ?? []) as Order[]);
      setLoading(false);
    })();
  }, [supabase]);

  const { from, to } = useMemo(() => rangeFor(period, customFrom, customTo), [period, customFrom, customTo]);

  const periodOrders = useMemo(
    () =>
      orders.filter((o) => {
        const d = new Date(o.created_at);
        return d >= from && d < to;
      }),
    [orders, from, to]
  );

  const validOrders = periodOrders.filter((o) => o.status !== 'canceled');
  const revenue = validOrders.reduce((s, o) => s + Number(o.total), 0);
  const ticketMedio = validOrders.length ? revenue / validOrders.length : 0;
  const itemsSold = validOrders.reduce((s, o) => s + (o.order_items ?? []).reduce((a, i) => a + i.quantity, 0), 0);

  const dailySeries = useMemo(() => {
    const days: { label: string; revenue: number; count: number }[] = [];
    const totalDays = Math.max(1, Math.min(31, Math.ceil((to.getTime() - from.getTime()) / 86400000)));
    for (let i = totalDays - 1; i >= 0; i--) {
      const day = startOfDay(to);
      day.setDate(day.getDate() - i);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      const dayOrders = orders.filter((o) => {
        const d = new Date(o.created_at);
        return d >= day && d < next && d >= from && d < to && o.status !== 'canceled';
      });
      days.push({
        label: day.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
        revenue: dayOrders.reduce((s, o) => s + Number(o.total), 0),
        count: dayOrders.length,
      });
    }
    return days;
  }, [orders, from, to]);

  const maxRevenue = Math.max(1, ...dailySeries.map((d) => d.revenue));

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of validOrders) {
      for (const item of o.order_items ?? []) {
        const cur = map.get(item.product_name) ?? { name: item.product_name, qty: 0, revenue: 0 };
        cur.qty += item.quantity;
        cur.revenue += Number(item.total);
        map.set(item.product_name, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [validOrders]);

  const maxProductRevenue = Math.max(1, ...topProducts.map((p) => p.revenue));

  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const o of validOrders) {
      const cur = map.get(o.payment_method) ?? { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += Number(o.total);
      map.set(o.payment_method, cur);
    }
    return [...map.entries()].map(([method, v]) => ({ method, ...v }));
  }, [validOrders]);

  const fulfillmentBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of validOrders) map.set(o.fulfillment, (map.get(o.fulfillment) ?? 0) + 1);
    return map;
  }, [validOrders]);

  const channelBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of validOrders) map.set(o.channel, (map.get(o.channel) ?? 0) + 1);
    return map;
  }, [validOrders]);

  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; whatsapp: string; orders: number; total: number }>();
    for (const o of validOrders) {
      const key = o.customer_whatsapp;
      const cur = map.get(key) ?? { name: o.customer_name, whatsapp: o.customer_whatsapp, orders: 0, total: 0 };
      cur.orders += 1;
      cur.total += Number(o.total);
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  }, [validOrders]);

  const maxCustomerTotal = Math.max(1, ...topCustomers.map((c) => c.total));

  const exportOrders = () => {
    const rows: (string | number)[][] = [
      ['Código', 'Data', 'Cliente', 'WhatsApp', 'Canal', 'Tipo', 'Pagamento', 'Status', 'Subtotal', 'Entrega', 'Desconto', 'Total'],
      ...periodOrders.map((o) => [
        o.code,
        new Date(o.created_at).toLocaleString('pt-BR'),
        o.customer_name,
        o.customer_whatsapp,
        o.channel,
        o.fulfillment === 'delivery' ? 'Entrega' : 'Retirada',
        PAYMENT_LABELS[o.payment_method],
        o.status,
        Number(o.subtotal).toFixed(2),
        Number(o.delivery_fee).toFixed(2),
        Number(o.discount).toFixed(2),
        Number(o.total).toFixed(2),
      ]),
    ];
    downloadCsv(`pedidos_${toInputDate(from)}_a_${toInputDate(to)}.csv`, rows);
  };

  const exportProducts = () => {
    const rows: (string | number)[][] = [
      ['Produto', 'Quantidade vendida', 'Faturamento'],
      ...topProducts.map((p) => [p.name, p.qty, p.revenue.toFixed(2)]),
    ];
    downloadCsv(`produtos_${toInputDate(from)}_a_${toInputDate(to)}.csv`, rows);
  };

  if (loading) return <p className="text-neutral-500 py-8 text-center">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold mr-auto">Relatórios</h1>
        <div className="flex flex-wrap gap-1.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold border ${
                period === opt.value ? 'bg-brand text-white border-brand' : 'bg-white border-neutral-300 text-neutral-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {period === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-neutral-500">
            De{' '}
            <input type="date" className="input !w-auto" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} />
          </label>
          <label className="text-sm text-neutral-500">
            Até{' '}
            <input
              type="date"
              className="input !w-auto"
              value={customTo}
              min={customFrom}
              max={toInputDate(new Date())}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </label>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={exportOrders} className="border border-neutral-300 rounded-lg px-3.5 py-2 text-xs font-semibold bg-white hover:border-brand">
          ⬇️ Exportar pedidos (CSV)
        </button>
        <button onClick={exportProducts} className="border border-neutral-300 rounded-lg px-3.5 py-2 text-xs font-semibold bg-white hover:border-brand">
          ⬇️ Exportar produtos (CSV)
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-neutral-500">Pedidos</p>
          <p className="text-2xl font-bold mt-1">{validOrders.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">Faturamento</p>
          <p className="text-2xl font-bold mt-1">{brl(revenue)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">Ticket médio</p>
          <p className="text-2xl font-bold mt-1">{brl(ticketMedio)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">Itens vendidos</p>
          <p className="text-2xl font-bold mt-1">{itemsSold}</p>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="font-bold mb-3">Faturamento por dia</h2>
        <div className="flex items-end gap-2 h-40 overflow-x-auto">
          {dailySeries.map((d, i) => (
            <div key={i} className="flex-1 min-w-[2.5rem] flex flex-col items-center gap-1">
              <span className="text-xs font-semibold">{d.revenue > 0 ? brl(d.revenue) : ''}</span>
              <div className="w-full bg-brand rounded-t-md" style={{ height: `${Math.max(4, (d.revenue / maxRevenue) * 100)}px` }} />
              <span className="text-[11px] text-neutral-500 capitalize">{d.label}</span>
              <span className="text-[11px] text-neutral-400">{d.count} ped.</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="font-bold mb-3">🏆 Produtos mais vendidos</h2>
          {topProducts.length === 0 && <p className="text-sm text-neutral-400">Sem dados no período.</p>}
          <div className="space-y-2.5">
            {topProducts.map((p, i) => (
              <div key={p.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="truncate pr-2">
                    <span className="text-neutral-400 mr-1.5">{i + 1}º</span>
                    {p.name} <span className="text-neutral-400">· {p.qty}x</span>
                  </span>
                  <span className="font-semibold shrink-0">{brl(p.revenue)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                  <div className="h-full bg-brand rounded-full" style={{ width: `${(p.revenue / maxProductRevenue) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="font-bold mb-3">👤 Clientes que mais compraram</h2>
          {topCustomers.length === 0 && <p className="text-sm text-neutral-400">Sem dados no período.</p>}
          <div className="space-y-2.5">
            {topCustomers.map((c, i) => (
              <div key={c.whatsapp}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="truncate pr-2">
                    <span className="text-neutral-400 mr-1.5">{i + 1}º</span>
                    {c.name} <span className="text-neutral-400">· {c.orders} ped.</span>
                  </span>
                  <span className="font-semibold shrink-0">{brl(c.total)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                  <div className="h-full bg-brand rounded-full" style={{ width: `${(c.total / maxCustomerTotal) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <h2 className="font-bold mb-3">💳 Pagamento</h2>
          <div className="space-y-2">
            {paymentBreakdown.map((p) => (
              <div key={p.method} className="flex justify-between text-sm">
                <span>{PAYMENT_LABELS[p.method as keyof typeof PAYMENT_LABELS]}</span>
                <span className="font-semibold">
                  {p.count} · {brl(p.revenue)}
                </span>
              </div>
            ))}
            {paymentBreakdown.length === 0 && <p className="text-sm text-neutral-400">Sem dados.</p>}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="font-bold mb-3">🛵 Entrega x Retirada</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Entrega</span>
              <span className="font-semibold">{fulfillmentBreakdown.get('delivery') ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Retirada</span>
              <span className="font-semibold">{fulfillmentBreakdown.get('pickup') ?? 0}</span>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="font-bold mb-3">📡 Canal</h2>
          <div className="space-y-2 text-sm">
            {[...channelBreakdown.entries()].map(([channel, count]) => (
              <div key={channel} className="flex justify-between">
                <span className="capitalize">{channel === 'web' ? 'Loja online' : channel === 'counter' ? 'Balcão' : channel === 'phone' ? 'Telefone' : 'WhatsApp'}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
            {channelBreakdown.size === 0 && <p className="text-neutral-400">Sem dados.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
