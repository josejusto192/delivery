'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { brl } from '@/lib/format';
import { ORDER_STATUS_LABELS, type Order, type OrderStatus } from '@/lib/types';
import { PERIOD_OPTIONS, rangeFor, startOfDay, toInputDate, type Period } from '@/lib/period';

const ALL_STATUSES: OrderStatus[] = [
  'new',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
  'canceled',
];

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('today');
  const [customFrom, setCustomFrom] = useState(toInputDate(new Date()));
  const [customTo, setCustomTo] = useState(toInputDate(new Date()));

  useEffect(() => {
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const { data } = await supabase
        .from('orders')
        .select('*')
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

  const statusCounts = useMemo(() => {
    const map = new Map<OrderStatus, number>();
    for (const o of periodOrders) {
      map.set(o.status, (map.get(o.status) ?? 0) + 1);
    }
    return map;
  }, [periodOrders]);

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

  if (loading) {
    return <p className="text-neutral-500 py-8 text-center">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold mr-auto">Dashboard</h1>
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
            <input
              type="date"
              className="input !w-auto"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
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
          <p className="text-xs text-neutral-500">Cancelados</p>
          <p className="text-2xl font-bold mt-1">{statusCounts.get('canceled') ?? 0}</p>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="font-bold mb-3">Pedidos por status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {ALL_STATUSES.map((s) => (
            <div key={s} className="rounded-lg bg-neutral-100 p-3 text-center">
              <p className="text-xs text-neutral-500">{ORDER_STATUS_LABELS[s]}</p>
              <p className="text-xl font-bold mt-1">{statusCounts.get(s) ?? 0}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="font-bold mb-3">Faturamento por dia</h2>
        <div className="flex items-end gap-2 h-40 overflow-x-auto">
          {dailySeries.map((d, i) => (
            <div key={i} className="flex-1 min-w-[2.5rem] flex flex-col items-center gap-1">
              <span className="text-xs font-semibold">{d.revenue > 0 ? brl(d.revenue) : ''}</span>
              <div
                className="w-full bg-brand rounded-t-md"
                style={{ height: `${Math.max(4, (d.revenue / maxRevenue) * 100)}px` }}
              />
              <span className="text-[11px] text-neutral-500 capitalize">{d.label}</span>
              <span className="text-[11px] text-neutral-400">{d.count} ped.</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
