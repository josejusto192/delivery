'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart';
import { brl } from '@/lib/format';

export default function CartPage() {
  const { items, updateQuantity, removeItem, subtotal } = useCart();
  const router = useRouter();

  if (items.length === 0) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-neutral-500">Seu carrinho está vazio.</p>
        <Link href="/" className="btn-brand inline-block">
          Ver cardápio
        </Link>
      </div>
    );
  }

  return (
    <div className="py-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Carrinho</h1>

      <div className="card divide-y divide-neutral-100">
        {items.map((item) => {
          const addonsTotal = item.addons.reduce((s, a) => s + Number(a.price), 0);
          const lineTotal = (Number(item.unitPrice) + addonsTotal) * item.quantity;
          return (
            <div key={item.key} className="p-4 flex gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{item.name}</p>
                {item.addons.length > 0 && (
                  <p className="text-sm text-neutral-500">
                    {item.addons.map((a) => a.name).join(', ')}
                  </p>
                )}
                {item.notes && <p className="text-sm text-neutral-400 italic">“{item.notes}”</p>}
                <p className="text-brand font-bold mt-1">{brl(lineTotal)}</p>
              </div>
              <div className="flex flex-col items-end justify-between">
                <button
                  onClick={() => removeItem(item.key)}
                  className="text-xs text-neutral-400 hover:text-red-500"
                >
                  Remover
                </button>
                <div className="flex items-center border border-neutral-300 rounded-lg text-sm">
                  <button
                    className="px-3 py-1.5 font-bold"
                    onClick={() => updateQuantity(item.key, item.quantity - 1)}
                  >
                    −
                  </button>
                  <span className="w-7 text-center font-semibold">{item.quantity}</span>
                  <button
                    className="px-3 py-1.5 font-bold"
                    onClick={() => updateQuantity(item.key, item.quantity + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card p-4 flex items-center justify-between">
        <span className="font-medium">Subtotal</span>
        <span className="font-bold text-lg">{brl(subtotal)}</span>
      </div>

      <div className="flex gap-3">
        <Link href="/" className="flex-1 text-center border border-neutral-300 rounded-lg px-4 py-3 font-semibold bg-white">
          Adicionar mais itens
        </Link>
        <button className="btn-brand flex-1" onClick={() => router.push('/checkout')}>
          Finalizar pedido
        </button>
      </div>
    </div>
  );
}
