'use client';

import { useMemo, useState } from 'react';
import type { AddonGroup, Product } from '@/lib/types';
import { brl } from '@/lib/format';
import { useCart, type CartAddon } from '@/lib/cart';

function groupSubtitle(g: AddonGroup): string {
  if (g.max_select === 1) return 'selecione 1';
  if (g.min_select > 0 && g.min_select === g.max_select) return `selecione ${g.min_select}`;
  if (g.min_select > 0) return `selecione de ${g.min_select} até ${g.max_select}`;
  return 'opcional · escolha quantos quiser';
}

export default function ProductModal({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<Record<string, CartAddon[]>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [added, setAdded] = useState(false);

  const groups = (product.addon_groups ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);

  const hasPromo = product.promo_price != null && Number(product.promo_price) < Number(product.price);
  const effectivePrice = hasPromo ? Number(product.promo_price) : Number(product.price);
  const offPercent = hasPromo
    ? Math.round((1 - Number(product.promo_price) / Number(product.price)) * 100)
    : 0;

  const toggleAddon = (group: AddonGroup, addon: CartAddon) => {
    setSelectedAddons((prev) => {
      const current = prev[group.id] ?? [];
      const exists = current.some((a) => a.name === addon.name);

      // seleção única (radio): troca a opção; só desmarca se o grupo for opcional
      if (group.max_select === 1) {
        if (exists) {
          return group.min_select === 0 ? { ...prev, [group.id]: [] } : prev;
        }
        // resposta dada → recolhe o grupo automaticamente
        setCollapsed((c) => ({ ...c, [group.id]: true }));
        return { ...prev, [group.id]: [addon] };
      }

      if (exists) return { ...prev, [group.id]: current.filter((a) => a.name !== addon.name) };
      if (current.length >= group.max_select) return prev;
      const next = [...current, addon];
      // atingiu o máximo → recolhe
      if (next.length >= group.max_select) setCollapsed((c) => ({ ...c, [group.id]: true }));
      return { ...prev, [group.id]: next };
    });
  };

  const allAddons = useMemo(() => Object.values(selectedAddons).flat(), [selectedAddons]);
  const addonsTotal = allAddons.reduce((s, a) => s + Number(a.price), 0);
  const total = (effectivePrice + addonsTotal) * quantity;

  const groupOk = (g: AddonGroup) => (selectedAddons[g.id]?.length ?? 0) >= g.min_select;
  const minOk = groups.every(groupOk);

  const handleAdd = () => {
    if (!minOk) {
      setShowErrors(true);
      // abre os grupos pendentes
      setCollapsed((c) => {
        const next = { ...c };
        groups.forEach((g) => {
          if (!groupOk(g)) next[g.id] = false;
        });
        return next;
      });
      return;
    }
    addItem({
      productId: product.id,
      name: product.name,
      unitPrice: effectivePrice,
      quantity,
      addons: allAddons,
      notes,
    });
    setAdded(true);
    setTimeout(onClose, 400);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto">
          {product.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.name} className="w-full h-36 sm:h-44 object-cover sm:rounded-t-2xl" />
          )}

          <div className="p-4 pb-2">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold leading-snug">{product.name}</h2>
              <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-2xl leading-none shrink-0">
                ×
              </button>
            </div>

            {hasPromo ? (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="bg-green-600 text-white text-xs font-bold rounded px-1.5 py-0.5">
                  -{offPercent}%
                </span>
                <span className="text-neutral-400 text-sm line-through">{brl(Number(product.price))}</span>
                <span className="text-green-600 font-bold">{brl(effectivePrice)}</span>
              </div>
            ) : (
              <p className="text-brand font-bold mt-0.5">{brl(effectivePrice)}</p>
            )}

            {product.description && (
              <p className="text-neutral-500 text-xs mt-1.5 line-clamp-3">{product.description}</p>
            )}
          </div>

          <div className="px-4 pb-2 space-y-2">
            {groups.map((g) => {
              const isRadio = g.max_select === 1;
              const selected = selectedAddons[g.id] ?? [];
              const done = groupOk(g) && selected.length > 0;
              const missing = showErrors && !groupOk(g);
              const isCollapsed = collapsed[g.id] ?? false;
              return (
                <div
                  key={g.id}
                  className={`border rounded-xl overflow-hidden ${
                    missing ? 'border-red-300' : done ? 'border-green-200' : 'border-neutral-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setCollapsed((c) => ({ ...c, [g.id]: !isCollapsed }))}
                    className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left ${
                      missing ? 'bg-red-50' : 'bg-neutral-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm leading-snug">{g.name}</h3>
                      <p className={`text-xs mt-0.5 truncate ${
                        missing ? 'text-red-500 font-semibold' : done ? 'text-green-600' : 'text-neutral-500'
                      }`}>
                        {missing
                          ? 'escolha uma opção para continuar'
                          : done && isCollapsed
                            ? selected.map((s) => s.name).join(', ')
                            : groupSubtitle(g)}
                      </p>
                    </div>
                    <span className="flex items-center gap-2 shrink-0">
                      {done ? (
                        <span className="h-5 w-5 rounded-full bg-green-500 text-white grid place-items-center text-xs">✓</span>
                      ) : g.min_select > 0 ? (
                        <span className="bg-brand text-white text-[10px] font-bold rounded px-1.5 py-1">obrigatório</span>
                      ) : (
                        <span className="text-neutral-400 text-[10px]">opcional</span>
                      )}
                      <span className={`text-neutral-400 text-xs transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>▾</span>
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div>
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
                              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 text-left border-t border-neutral-100 ${
                                checked ? 'bg-brand/5' : ''
                              }`}
                            >
                              <span className="flex items-center gap-2.5 text-sm">
                                <span
                                  className={`h-4 w-4 shrink-0 grid place-items-center border-2 text-[10px] ${
                                    isRadio ? 'rounded-full' : 'rounded'
                                  } ${checked ? 'bg-brand border-brand text-white' : 'border-neutral-300'}`}
                                >
                                  {checked && '✓'}
                                </span>
                                {a.name}
                              </span>
                              {Number(a.price) > 0 && (
                                <span className="text-xs text-neutral-600 font-medium shrink-0">
                                  +{brl(Number(a.price))}
                                </span>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-4 pb-4 pt-1">
            <textarea
              className="input !text-sm"
              rows={2}
              placeholder="Alguma observação? Ex.: sem cebola..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="border-t border-neutral-200 p-3.5 flex items-center gap-3 bg-white sm:rounded-b-2xl">
          <div className="flex items-center border border-neutral-300 rounded-full">
            <button className="px-3.5 py-2 font-bold text-brand" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
              −
            </button>
            <span className="w-7 text-center font-semibold text-sm">{quantity}</span>
            <button className="px-3.5 py-2 font-bold text-brand" onClick={() => setQuantity((q) => q + 1)}>
              +
            </button>
          </div>
          <button
            className={`flex-1 rounded-full px-4 py-2.5 font-semibold text-white text-sm transition-colors ${
              minOk ? 'bg-brand hover:bg-brand-dark' : 'bg-neutral-300'
            }`}
            disabled={added}
            onClick={handleAdd}
          >
            {added ? 'Adicionado ✓' : `adicionar · ${brl(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
