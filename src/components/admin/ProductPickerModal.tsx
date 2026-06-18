'use client';

import { useMemo, useState } from 'react';
import { brl } from '@/lib/format';
import type { AddonGroup, Product } from '@/lib/types';

export type CartAddon = { name: string; price: number };
export type CartItemInput = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  addons: CartAddon[];
  notes: string;
};

export default function ProductPickerModal({
  product,
  onClose,
  onAdd,
}: {
  product: Product;
  onClose: () => void;
  onAdd: (item: CartItemInput) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<Record<string, CartAddon[]>>({});
  const [showErrors, setShowErrors] = useState(false);

  const groups = (product.addon_groups ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const hasPromo = product.promo_price != null && Number(product.promo_price) < Number(product.price);
  const effectivePrice = hasPromo ? Number(product.promo_price) : Number(product.price);

  const toggleAddon = (group: AddonGroup, addon: CartAddon) => {
    setSelectedAddons((prev) => {
      const current = prev[group.id] ?? [];
      const exists = current.some((a) => a.name === addon.name);
      if (group.max_select === 1) {
        if (exists) return group.min_select === 0 ? { ...prev, [group.id]: [] } : prev;
        return { ...prev, [group.id]: [addon] };
      }
      if (exists) return { ...prev, [group.id]: current.filter((a) => a.name !== addon.name) };
      if (current.length >= group.max_select) return prev;
      return { ...prev, [group.id]: [...current, addon] };
    });
  };

  const allAddons = useMemo(() => Object.values(selectedAddons).flat(), [selectedAddons]);
  const addonsTotal = allAddons.reduce((s, a) => s + Number(a.price), 0);
  const total = (effectivePrice + addonsTotal) * quantity;
  const groupOk = (g: AddonGroup) => (selectedAddons[g.id]?.length ?? 0) >= g.min_select;
  const minOk = groups.every(groupOk);

  const handleAdd = () => {
    if (!minOk) return setShowErrors(true);
    onAdd({ productId: product.id, name: product.name, unitPrice: effectivePrice, quantity, addons: allAddons, notes });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{product.name}</h2>
              <p className="text-brand font-bold">{brl(effectivePrice)}</p>
            </div>
            <button onClick={onClose} className="text-neutral-400 text-2xl leading-none">×</button>
          </div>

          {groups.map((g) => {
            const isRadio = g.max_select === 1;
            const selected = selectedAddons[g.id] ?? [];
            const missing = showErrors && !groupOk(g);
            return (
              <div key={g.id}>
                <div className={`px-3 py-2 rounded-lg flex items-center justify-between ${missing ? 'bg-red-50' : 'bg-neutral-100'}`}>
                  <span className="font-semibold text-sm">{g.name}</span>
                  {g.min_select > 0 && <span className="text-[10px] bg-brand text-white rounded px-1.5 py-0.5">obrigatório</span>}
                </div>
                <div className="px-1">
                  {(g.addons ?? [])
                    .filter((a) => a.active)
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((a) => {
                      const checked = selected.some((s) => s.name === a.name);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => toggleAddon(g, { name: a.name, price: Number(a.price) })}
                          className="w-full flex items-center justify-between gap-2 py-2 text-sm border-b border-neutral-100 last:border-0"
                        >
                          <span className="flex items-center gap-2">
                            <span className={`h-5 w-5 shrink-0 grid place-items-center border-2 text-xs ${isRadio ? 'rounded-full' : 'rounded-md'} ${checked ? 'bg-brand border-brand text-white' : 'border-neutral-300'}`}>
                              {checked && '✓'}
                            </span>
                            {a.name}
                          </span>
                          {Number(a.price) > 0 && <span className="text-neutral-600 text-xs font-medium">+{brl(Number(a.price))}</span>}
                        </button>
                      );
                    })}
                </div>
              </div>
            );
          })}

          <textarea className="input" rows={2} placeholder="Observações" value={notes} onChange={(e) => setNotes(e.target.value)} />

          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center border border-neutral-300 rounded-full">
              <button className="px-3 py-2 font-bold text-brand" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
              <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
              <button className="px-3 py-2 font-bold text-brand" onClick={() => setQuantity((q) => q + 1)}>+</button>
            </div>
            <button className={`flex-1 rounded-full px-4 py-2.5 font-semibold text-white ${minOk ? 'bg-brand' : 'bg-neutral-300'}`} onClick={handleAdd}>
              Adicionar · {brl(total)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
