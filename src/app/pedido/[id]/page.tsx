'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { brl, formatDateTime } from '@/lib/format';
import {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
  PAYMENT_LABELS,
  type OrderStatus,
  type StoreSettings,
} from '@/lib/types';

type PublicOrder = {
  id: string;
  code: number;
  status: OrderStatus;
  customer_name: string;
  customer_whatsapp: string;
  fulfillment: 'delivery' | 'pickup';
  address: Record<string, string> | null;
  payment_method: 'pix' | 'card' | 'cash';
  change_for: number | null;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  coupon_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: { product_name: string; quantity: number; addons: { name: string; price: number }[]; notes: string | null; total: number }[];
  history: { status: OrderStatus; at: string }[];
};

function hourOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.rpc('get_order_public', { p_order_id: id });
      if (!active) return;
      if (!data) setNotFound(true);
      else setOrder(data as PublicOrder);
    };
    load();
    supabase
      .from('store_settings')
      .select('*')
      .single()
      .then(({ data }) => active && setSettings(data));
    supabase.auth.getUser().then(({ data }) => active && setLoggedIn(!!data.user));
    const interval = setInterval(load, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [id, supabase]);

  if (notFound) return <p className="py-20 text-center text-neutral-500">Pedido não encontrado.</p>;
  if (!order) return <p className="py-20 text-center text-neutral-400">Carregando...</p>;

  const flow = ORDER_STATUS_FLOW.filter((s) => order.fulfillment === 'delivery' || s !== 'out_for_delivery');
  const currentIndex = flow.indexOf(order.status);
  const canceled = order.status === 'canceled';
  const active = !canceled && order.status !== 'delivered';

  // último horário registrado para cada status
  const timeOf = (status: OrderStatus): string | null => {
    const entries = (order.history ?? []).filter((h) => h.status === status);
    return entries.length ? hourOf(entries[entries.length - 1].at) : null;
  };

  const addr = order.address;
  const storeWhats = settings?.whatsapp?.replace(/\D/g, '');

  return (
    <div className="py-6 max-w-2xl mx-auto space-y-4">
      <div className="card p-3 text-center bg-green-50 border-green-200 text-green-700 text-sm font-medium">
        ✓ Pedido recebido com sucesso!
      </div>

      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold">Pedido #{order.code}</h1>
        <p className="text-neutral-500 text-sm">Feito em {formatDateTime(order.created_at)}</p>
        {active && order.fulfillment === 'delivery' && settings && (
          <p className="text-sm font-medium text-brand">
            Previsão de entrega: {settings.delivery_time_min}–{settings.delivery_time_max} min
          </p>
        )}
      </div>

      <div className="card p-5">
        {canceled ? (
          <div className="text-center">
            <p className="text-red-500 font-semibold">Pedido cancelado</p>
            {timeOf('canceled') && (
              <p className="text-xs text-neutral-400 mt-1">às {timeOf('canceled')}</p>
            )}
          </div>
        ) : (
          <ol className="space-y-1">
            {flow.map((status, i) => {
              const done = i <= currentIndex;
              const current = i === currentIndex;
              const time = done ? timeOf(status) : null;
              return (
                <li key={status} className="flex items-center gap-3 py-1.5">
                  <span
                    className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold shrink-0 ${
                      done ? 'bg-brand text-white' : 'bg-neutral-200 text-neutral-400'
                    } ${current ? 'ring-4 ring-brand/20' : ''}`}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  <span className={`text-sm flex-1 ${current ? 'font-bold' : done ? 'font-medium' : 'text-neutral-400'}`}>
                    {ORDER_STATUS_LABELS[status]}
                  </span>
                  {time && <span className="text-xs text-neutral-400">{time}</span>}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-semibold">Itens</h2>
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm gap-3">
            <div>
              <p className="font-medium">
                {item.quantity}× {item.product_name}
              </p>
              {item.addons?.length > 0 && (
                <p className="text-neutral-500 text-xs">{item.addons.map((a) => a.name).join(', ')}</p>
              )}
              {item.notes && <p className="text-neutral-400 text-xs italic">“{item.notes}”</p>}
            </div>
            <span className="shrink-0">{brl(Number(item.total))}</span>
          </div>
        ))}
        <div className="border-t border-neutral-100 pt-3 text-sm space-y-1">
          <div className="flex justify-between text-neutral-500">
            <span>Subtotal</span>
            <span>{brl(Number(order.subtotal))}</span>
          </div>
          <div className="flex justify-between text-neutral-500">
            <span>Entrega</span>
            <span>{Number(order.delivery_fee) === 0 ? 'Grátis' : brl(Number(order.delivery_fee))}</span>
          </div>
          {Number(order.discount) > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Desconto{order.coupon_code ? ` (${order.coupon_code})` : ''}</span>
              <span>− {brl(Number(order.discount))}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span>{brl(Number(order.total))}</span>
          </div>
          <p className="text-neutral-500 pt-1">
            Pagamento: {PAYMENT_LABELS[order.payment_method]}
            {order.payment_method === 'cash' && order.change_for && <> · troco para {brl(Number(order.change_for))}</>}
          </p>
        </div>
      </div>

      <div className="card p-5 space-y-2 text-sm">
        <h2 className="font-semibold">{order.fulfillment === 'delivery' ? 'Entrega' : 'Retirada'}</h2>
        {order.fulfillment === 'delivery' && addr ? (
          <p className="text-neutral-600">
            {addr.street}, {addr.number}
            {addr.complement ? ` — ${addr.complement}` : ''}
            <br />
            {addr.neighborhood}
            {addr.city ? `, ${addr.city}` : ''}
            {addr.reference ? ` · Ref.: ${addr.reference}` : ''}
          </p>
        ) : (
          <p className="text-neutral-600">
            Retirar em: {settings?.address ?? 'endereço da loja'}
          </p>
        )}
        <p className="text-neutral-500 pt-1 border-t border-neutral-100">
          Pedido em nome de <strong>{order.customer_name}</strong> · {order.customer_whatsapp}
        </p>
        {order.notes && <p className="text-neutral-500">Obs.: {order.notes}</p>}
      </div>

      {loggedIn === false && (
        <div className="card p-5 text-center space-y-2">
          <h2 className="font-semibold text-sm">Salve este pedido na sua conta</h2>
          <p className="text-sm text-neutral-500">
            Você fez este pedido sem login. Guarde o link desta página para acompanhá-lo, ou crie uma conta para ver
            todos os seus pedidos em um só lugar.
          </p>
          <Link
            href={`/conta/entrar?next=/pedido/${order.id}`}
            className="inline-block btn-brand !py-2 !px-6 text-sm"
          >
            Criar conta ou entrar
          </Link>
        </div>
      )}

      <div className="card p-5 text-center space-y-2">
        <h2 className="font-semibold text-sm">Precisa de ajuda com seu pedido?</h2>
        {storeWhats ? (
          <a
            href={`https://wa.me/55${storeWhats}?text=${encodeURIComponent(`Olá! Preciso de ajuda com o pedido #${order.code}.`)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-block bg-green-500 hover:bg-green-600 text-white font-semibold rounded-full px-6 py-2.5 text-sm transition-colors"
          >
            Falar com a loja no WhatsApp
          </a>
        ) : (
          settings?.phone && <p className="text-sm text-neutral-600">Ligue para {settings.phone}</p>
        )}
        {settings?.phone && storeWhats && (
          <p className="text-xs text-neutral-400">ou ligue: {settings.phone}</p>
        )}
      </div>

      <p className="text-center text-xs text-neutral-400">Esta página atualiza automaticamente.</p>
      <div className="text-center">
        <Link href="/" className="text-brand font-semibold text-sm">
          Voltar ao cardápio
        </Link>
      </div>
    </div>
  );
}
