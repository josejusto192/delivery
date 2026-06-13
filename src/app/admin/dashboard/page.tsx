'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { brl } from '@/lib/format';
import { ORDER_STATUS_LABELS, type Order, type OrderStatus } from '@/lib/types';

const ALL_STATUSES: OrderStatus[] = [
  'new',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
  'canceled',
];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const { data } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(1000);
      setOrders((data ?? []) as Order[]);
      setLoading(false);
    })();
  }, [supabase]);

  const today = startOfDay(new Date());

  const todayOrders = useMemo(
    () => orders.filter((o) => new Date(o.created_at) >= today && o.status !== 'canceled'),
    [orders, today]
  );

  const revenueToday = todayOrders.reduce((s, o) => s + Number(o.total), 0);
  const ticketMedio = todayOrders.length ? revenueToday / todayOrders.length : 0;

  const statusCounts = useMemo(() => {
    const map = new Map<OrderStatus, number>();
    for (const o of orders.filter((o) => new Date(o.created_at) >= today)) {
      map.set(o.status, (map.get(o.status) ?? 0) + 1);
    }
    return map;
  }, [orders, today]);

  const last7Days = useMemo(() => {
    const days: { label: string; revenue: number; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = startOfDay(new Date());
      day.setDate(day.getDate() - i);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      const dayOrders = orders.filter((o) => {
        const d = new Date(o.created_at);
        return d >= day && d < next && o.status !== 'canceled';
      });
      days.push({
        label: day.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
        revenue: dayOrders.reduce((s, o) => s + Number(o.total), 0),
        count: dayOrders.length,
      });
    }
    return days;
  }, [orders]);

  const maxRevenue = Math.max(1, ...last7Days.map((d) => d.revenue));

  if (loading) {
    return <p className="text-neutral-500 py-8 text-center">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-neutral-500">Pedidos hoje</p>
          <p className="text-2xl font-bold mt-1">{todayOrders.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">Faturamento hoje</p>
          <p className="text-2xl font-bold mt-1">{brl(revenueToday)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">Ticket médio</p>
          <p className="text-2xl font-bold mt-1">{brl(ticketMedio)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">Cancelados hoje</p>
          <p className="text-2xl font-bold mt-1">{statusCounts.get('canceled') ?? 0}</p>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="font-bold mb-3">Pedidos por status (hoje)</h2>
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
        <h2 className="font-bold mb-3">Faturamento — últimos 7 dias</h2>
        <div className="flex items-end gap-2 h-40">
          {last7Days.map((d) => (
            <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
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
