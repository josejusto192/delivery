'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { brl, formatDateTime } from '@/lib/format';
import {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
  PAYMENT_LABELS,
  type Order,
  type OrderStatus,
} from '@/lib/types';

const KANBAN_COLUMNS: OrderStatus[] = ['new', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
const ACTIVE_STATUSES = KANBAN_COLUMNS;

const STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-indigo-100 text-indigo-700',
  preparing: 'bg-amber-100 text-amber-700',
  ready: 'bg-purple-100 text-purple-700',
  out_for_delivery: 'bg-cyan-100 text-cyan-700',
  delivered: 'bg-green-100 text-green-700',
  canceled: 'bg-red-100 text-red-600',
};

const COLUMN_ACCENT: Record<string, string> = {
  new: 'border-t-blue-500',
  confirmed: 'border-t-indigo-500',
  preparing: 'border-t-amber-500',
  ready: 'border-t-purple-500',
  out_for_delivery: 'border-t-cyan-500',
  delivered: 'border-t-green-500',
};

function nextStatus(order: Order): OrderStatus | null {
  const flow = ORDER_STATUS_FLOW.filter(
    (s) => order.fulfillment === 'delivery' || s !== 'out_for_delivery'
  );
  const i = flow.indexOf(order.status);
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null;
}

function minutesAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h${min % 60 > 0 ? ` ${min % 60}m` : ''}`;
}

function printOrder(order: Order) {
  const addr = order.address;
  const win = window.open('', '_blank', 'width=380,height=600');
  if (!win) return;
  const itemsHtml = (order.order_items ?? [])
    .map(
      (item) => `
        <div class="item">
          <div class="item-line"><span>${item.quantity}x ${escapeHtml(item.product_name)}</span><span>${brl(Number(item.total))}</span></div>
          ${item.addons?.length ? `<div class="addons">+ ${item.addons.map((a) => escapeHtml(a.name)).join(', ')}</div>` : ''}
          ${item.notes ? `<div class="addons">Obs: ${escapeHtml(item.notes)}</div>` : ''}
        </div>`
    )
    .join('');

  win.document.write(`
    <html>
      <head>
        <title>Pedido #${order.code}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: monospace; font-size: 13px; width: 280px; margin: 0 auto; padding: 12px; color: #000; }
          h1 { font-size: 18px; text-align: center; margin: 0 0 4px; }
          .center { text-align: center; }
          hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
          .item-line { display: flex; justify-content: space-between; gap: 8px; font-weight: bold; }
          .addons { font-size: 12px; padding-left: 10px; }
          .total-line { display: flex; justify-content: space-between; font-weight: bold; font-size: 15px; }
          .row { display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <h1>Pedido #${order.code}</h1>
        <p class="center">${formatDateTime(order.created_at)}</p>
        <hr />
        <p><strong>${escapeHtml(order.customer_name)}</strong><br/>${escapeHtml(order.customer_whatsapp)}</p>
        <p>${order.fulfillment === 'delivery' ? 'ENTREGA' : 'RETIRADA'} · ${PAYMENT_LABELS[order.payment_method]}${
          order.payment_method === 'cash' && order.change_for ? ` · troco p/ ${brl(Number(order.change_for))}` : ''
        }</p>
        ${
          addr
            ? `<p>${escapeHtml(addr.street)}, ${escapeHtml(addr.number)}${addr.complement ? ` - ${escapeHtml(addr.complement)}` : ''}<br/>${escapeHtml(addr.neighborhood)}${addr.area ? ` (${escapeHtml(addr.area)})` : ''}${addr.reference ? `<br/>Ref: ${escapeHtml(addr.reference)}` : ''}</p>`
            : ''
        }
        <hr />
        ${itemsHtml}
        <hr />
        <div class="row"><span>Subtotal</span><span>${brl(Number(order.subtotal))}</span></div>
        <div class="row"><span>Entrega</span><span>${Number(order.delivery_fee) === 0 ? 'Grátis' : brl(Number(order.delivery_fee))}</span></div>
        ${Number(order.discount) > 0 ? `<div class="row"><span>Desconto${order.coupon_code ? ` (${escapeHtml(order.coupon_code)})` : ''}</span><span>- ${brl(Number(order.discount))}</span></div>` : ''}
        <hr />
        <div class="total-line"><span>TOTAL</span><span>${brl(Number(order.total))}</span></div>
        ${order.notes ? `<hr /><p>Obs.: ${escapeHtml(order.notes)}</p>` : ''}
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export default function OrdersBoard() {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [filter, setFilter] = useState<'active' | 'all' | OrderStatus>('active');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Order | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<OrderStatus | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [notifyOn, setNotifyOn] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('orders-view');
      if (saved === 'list' || saved === 'kanban') setView(saved);
      const savedSound = localStorage.getItem('orders-sound');
      if (savedSound === 'off') setSoundOn(false);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') setNotifyOn(true);
    } catch {}
  }, []);

  const toggleSound = () => {
    setSoundOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('orders-sound', next ? 'on' : 'off');
      } catch {}
      return next;
    });
  };

  const toggleNotify = async () => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      setNotifyOn((v) => !v);
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifyOn(perm === 'granted');
  };

  const switchView = (v: 'kanban' | 'list') => {
    setView(v);
    try {
      localStorage.setItem('orders-view', v);
    } catch {}
  };

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })
      .limit(300);
    setOrders((data ?? []) as Order[]);
  }, [supabase]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('orders-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          if (soundOn) beep(audioRef);
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const o = payload.new as Order;
            try {
              new Notification(`Novo pedido #${o.code}`, {
                body: `${o.customer_name} · ${brl(Number(o.total))}`,
                tag: `order-${o.id}`,
              });
            } catch {}
          }
        }
        load();
      })
      .subscribe();
    const interval = setInterval(load, 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [supabase, load, soundOn]);

  const updateStatus = async (id: string, status: OrderStatus) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    setDetail((d) => (d && d.id === id ? { ...d, status } : d));
    await supabase.from('orders').update({ status }).eq('id', id);
  };

  const bySearch = useCallback(
    (list: Order[]) => {
      if (!search.trim()) return list;
      const q = search.trim().toLowerCase();
      return list.filter(
        (o) =>
          String(o.code).includes(q) ||
          o.customer_name.toLowerCase().includes(q) ||
          o.customer_whatsapp.includes(q)
      );
    },
    [search]
  );

  const kanbanOrders = useMemo(
    () => bySearch(orders.filter((o) => ACTIVE_STATUSES.includes(o.status))),
    [orders, bySearch]
  );

  const listOrders = useMemo(() => {
    let list = orders;
    if (filter === 'active') list = list.filter((o) => ACTIVE_STATUSES.includes(o.status));
    else if (filter !== 'all') list = list.filter((o) => o.status === filter);
    return bySearch(list);
  }, [orders, filter, bySearch]);

  const onDropTo = (status: OrderStatus) => {
    if (dragId) {
      const order = orders.find((o) => o.id === dragId);
      if (order && order.status !== status) updateStatus(dragId, status);
    }
    setDragId(null);
    setDragOver(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold mr-auto">Pedidos</h1>
        <button
          onClick={toggleSound}
          title={soundOn ? 'Som ativado' : 'Som desativado'}
          className={`h-9 w-9 flex items-center justify-center rounded-lg border text-sm ${
            soundOn ? 'bg-white border-neutral-300' : 'bg-neutral-100 border-neutral-300 text-neutral-400'
          }`}
        >
          {soundOn ? '🔔' : '🔕'}
        </button>
        <button
          onClick={toggleNotify}
          title={notifyOn ? 'Notificações ativadas' : 'Ativar notificações'}
          className={`h-9 w-9 flex items-center justify-center rounded-lg border text-sm ${
            notifyOn ? 'bg-white border-neutral-300' : 'bg-neutral-100 border-neutral-300 text-neutral-400'
          }`}
        >
          {notifyOn ? '🖥️' : '🚫'}
        </button>
        <div className="flex rounded-lg border border-neutral-300 overflow-hidden bg-white">
          <button
            onClick={() => switchView('kanban')}
            className={`px-4 py-2 text-sm font-semibold ${view === 'kanban' ? 'bg-brand text-white' : 'text-neutral-600'}`}
          >
            Kanban
          </button>
          <button
            onClick={() => switchView('list')}
            className={`px-4 py-2 text-sm font-semibold ${view === 'list' ? 'bg-brand text-white' : 'text-neutral-600'}`}
          >
            Lista
          </button>
        </div>
        <input
          className="input !w-auto sm:!w-64"
          placeholder="Buscar nº, nome ou WhatsApp"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {view === 'kanban' ? (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 lg:mx-0 lg:px-0">
          {KANBAN_COLUMNS.map((status) => {
            const items = kanbanOrders.filter((o) => o.status === status);
            return (
              <div
                key={status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(status);
                }}
                onDragLeave={() => setDragOver((d) => (d === status ? null : d))}
                onDrop={() => onDropTo(status)}
                className={`w-64 sm:w-72 shrink-0 rounded-xl bg-neutral-200/60 border-t-4 ${COLUMN_ACCENT[status]} ${
                  dragOver === status ? 'ring-2 ring-brand/60' : ''
                }`}
              >
                <div className="px-3 py-2.5 flex items-center justify-between">
                  <h2 className="font-bold text-sm">{ORDER_STATUS_LABELS[status]}</h2>
                  <span className="text-xs font-bold bg-white rounded-full px-2 py-0.5">{items.length}</span>
                </div>
                <div className="px-2 pb-2 space-y-2 min-h-24 max-h-[calc(100vh-16rem)] overflow-y-auto">
                  {items.map((order) => (
                    <KanbanCard
                      key={order.id}
                      order={order}
                      dragging={dragId === order.id}
                      onDragStart={() => setDragId(order.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setDragOver(null);
                      }}
                      onOpen={() => setDetail(order)}
                      onAdvance={() => {
                        const next = nextStatus(order);
                        if (next) updateStatus(order.id, next);
                      }}
                    />
                  ))}
                  {items.length === 0 && (
                    <p className="text-xs text-neutral-400 text-center py-6">vazio</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto">
            <FilterChip active={filter === 'active'} onClick={() => setFilter('active')} label="Em andamento" />
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="Todos" />
            {(['delivered', 'canceled'] as OrderStatus[]).map((s) => (
              <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)} label={ORDER_STATUS_LABELS[s]} />
            ))}
          </div>
          {listOrders.length === 0 && (
            <p className="text-neutral-500 text-sm py-8 text-center">Nenhum pedido.</p>
          )}
          <div className="space-y-2">
            {listOrders.map((order) => (
              <button
                key={order.id}
                onClick={() => setDetail(order)}
                className="card w-full p-4 flex items-center justify-between gap-3 text-left hover:border-brand"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">#{order.code}</span>
                    <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${STATUS_COLORS[order.status]}`}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                    <span className="text-xs text-neutral-400">{formatDateTime(order.created_at)}</span>
                  </div>
                  <p className="text-sm text-neutral-600 truncate mt-0.5">
                    {order.customer_name} · {order.fulfillment === 'delivery' ? 'Entrega' : 'Retirada'} ·{' '}
                    {PAYMENT_LABELS[order.payment_method]}
                  </p>
                </div>
                <span className="font-bold shrink-0">{brl(Number(order.total))}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {detail && (
        <OrderDetailModal
          order={orders.find((o) => o.id === detail.id) ?? detail}
          onClose={() => setDetail(null)}
          onStatus={updateStatus}
        />
      )}
    </div>
  );
}

function KanbanCard({
  order,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
  onAdvance,
}: {
  order: Order;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
  onAdvance: () => void;
}) {
  const next = nextStatus(order);
  const itemsCount = (order.order_items ?? []).reduce((s, i) => s + i.quantity, 0);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`card p-3 cursor-grab active:cursor-grabbing select-none ${dragging ? 'opacity-40' : ''}`}
    >
      <button onClick={onOpen} className="w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-sm">#{order.code}</span>
          <span className="text-[11px] text-neutral-400">há {minutesAgo(order.created_at)}</span>
        </div>
        <p className="text-sm truncate mt-1">{order.customer_name}</p>
        <p className="text-xs text-neutral-500 mt-0.5">
          {itemsCount} {itemsCount === 1 ? 'item' : 'itens'} · {order.fulfillment === 'delivery' ? '🛵 Entrega' : '🏪 Retirada'} · {PAYMENT_LABELS[order.payment_method]}
        </p>
        <p className="font-bold text-sm mt-1">{brl(Number(order.total))}</p>
      </button>
      {next && (
        <button
          onClick={onAdvance}
          className="mt-2 w-full text-xs font-semibold text-brand border border-brand/30 rounded-lg py-1.5 hover:bg-brand/5"
        >
          → {ORDER_STATUS_LABELS[next]}
        </button>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold border ${
        active ? 'bg-brand text-white border-brand' : 'bg-white border-neutral-300 text-neutral-600'
      }`}
    >
      {label}
    </button>
  );
}

function OrderDetailModal({
  order,
  onClose,
  onStatus,
}: {
  order: Order;
  onClose: () => void;
  onStatus: (id: string, status: OrderStatus) => void;
}) {
  const next = nextStatus(order);
  const addr = order.address;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">
                Pedido #{order.code}{' '}
                <span className={`ml-1 text-xs font-semibold rounded-full px-2.5 py-1 align-middle ${STATUS_COLORS[order.status]}`}>
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">{formatDateTime(order.created_at)}</p>
            </div>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-2xl leading-none">
              ×
            </button>
          </div>

          <div className="text-sm space-y-1.5 border-y border-neutral-100 py-3">
            {(order.order_items ?? []).map((item) => (
              <div key={item.id} className="flex justify-between gap-3">
                <span>
                  {item.quantity}× {item.product_name}
                  {item.addons?.length > 0 && (
                    <span className="text-neutral-500 text-xs"> ({item.addons.map((a) => a.name).join(', ')})</span>
                  )}
                  {item.notes && <span className="text-neutral-400 italic text-xs"> — “{item.notes}”</span>}
                </span>
                <span className="shrink-0">{brl(Number(item.total))}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold pt-1">
              <span>Total</span>
              <span>{brl(Number(order.total))}</span>
            </div>
          </div>

          <div className="text-sm text-neutral-600 space-y-1">
            <p>
              <strong>{order.customer_name}</strong> · {order.customer_whatsapp}{' '}
              <a
                href={`https://wa.me/55${order.customer_whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="text-green-600 font-semibold"
              >
                WhatsApp
              </a>
            </p>
            <p>
              {order.fulfillment === 'delivery' ? 'Entrega' : 'Retirada'} · {PAYMENT_LABELS[order.payment_method]}
              {order.payment_method === 'cash' && order.change_for && <> · troco p/ {brl(Number(order.change_for))}</>}
            </p>
            {addr && (
              <p>
                {addr.street}, {addr.number}
                {addr.complement ? ` — ${addr.complement}` : ''} · {addr.neighborhood}
                {addr.area ? ` (${addr.area})` : ''}
                {addr.reference ? ` · ref.: ${addr.reference}` : ''}
              </p>
            )}
            {order.coupon_code && (
              <p>
                Cupom {order.coupon_code} (− {brl(Number(order.discount))})
              </p>
            )}
            {order.notes && <p>Obs.: {order.notes}</p>}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              className="border border-neutral-300 rounded-lg px-4 py-2.5 text-sm font-semibold bg-white"
              onClick={() => printOrder(order)}
            >
              🖨️ Imprimir
            </button>
            {next && (
              <button className="btn-brand !py-2.5 text-sm flex-1" onClick={() => onStatus(order.id, next)}>
                Avançar para “{ORDER_STATUS_LABELS[next]}”
              </button>
            )}
            {order.status !== 'canceled' && order.status !== 'delivered' && (
              <button
                className="border border-red-300 text-red-500 rounded-lg px-4 py-2.5 text-sm font-semibold bg-white"
                onClick={() => onStatus(order.id, 'canceled')}
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function beep(ref: React.MutableRefObject<AudioContext | null>) {
  try {
    if (!ref.current) ref.current = new AudioContext();
    const ctx = ref.current;
    const tones = [880, 1100, 880];
    tones.forEach((freq, i) => {
      const start = ctx.currentTime + i * 0.35;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.35, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  } catch {}
}
