import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { brl, formatDateTime } from '@/lib/format';
import { ORDER_STATUS_LABELS, type Order } from '@/lib/types';

export default async function MyOrdersPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/conta/entrar');

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="py-8 max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Meus pedidos</h1>
      {(orders ?? []).length === 0 && (
        <p className="text-neutral-500 text-sm">Você ainda não fez nenhum pedido.</p>
      )}
      <div className="space-y-3">
        {((orders ?? []) as Order[]).map((order) => (
          <Link key={order.id} href={`/pedido/${order.id}`} className="card block p-4 hover:border-brand">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">Pedido #{order.code}</p>
                <p className="text-xs text-neutral-500">{formatDateTime(order.created_at)}</p>
              </div>
              <span
                className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
                  order.status === 'canceled'
                    ? 'bg-red-100 text-red-600'
                    : order.status === 'delivered'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                }`}
              >
                {ORDER_STATUS_LABELS[order.status]}
              </span>
            </div>
            <p className="font-bold mt-2">{brl(Number(order.total))}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
