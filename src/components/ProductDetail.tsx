'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AddonGroup, Product } from '@/lib/types';
import { brl } from '@/lib/format';
import { useCart, type CartAddon } from '@/lib/cart';

function groupSubtitle(g: AddonGroup): string {
  if (g.max_select === 1) return 'selecione 1';
  if (g.min_select > 0 && g.min_select === g.max_select) return `selecione ${g.min_select}`;
  if (g.min_select > 0) return `selecione de ${g.min_select} até ${g.max_select}`;
  return 'opcional · escolha quantos quiser';
}

export default function ProductDetail({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<Record<string, CartAddon[]>>({});
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
    if (!minOk) {
      setShowErrors(true);
      const firstMissing = groups.find((g) => !groupOk(g));
      if (firstMissing) {
        document.getElementById(`grupo-${firstMissing.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
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
    setTimeout(() => router.push('/'), 450);
  };

  return (
    <div className="max-w-2xl mx-auto pb-28">
      {/* imagem com botão voltar */}
      <div className="relative -mx-4 sm:mx-0">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name} className="w-full h-56 sm:h-72 object-cover sm:rounded-b-2xl" />
        ) : (
          <div className="h-14" />
        )}
        <button
          onClick={() => router.back()}
          aria-label="Voltar"
          className="absolute top-3 left-3 h-10 w-10 rounded-full bg-white shadow-md grid place-items-center text-brand text-xl"
        >
          ←
        </button>
      </div>

      <div className="py-4">
        <h1 className="text-2xl font-bold">{product.name}</h1>
        {hasPromo ? (
          <div className="flex items-center gap-2 mt-1">
            <span className="bg-green-600 text-white text-xs font-bold rounded px-1.5 py-0.5">-{offPercent}%</span>
            <span className="text-neutral-400 line-through">{brl(Number(product.price))}</span>
            <span className="text-green-600 font-bold text-xl">{brl(effectivePrice)}</span>
          </div>
        ) : (
          <p className="text-brand font-bold text-xl mt-1">{brl(effectivePrice)}</p>
        )}
        {product.description && <p className="text-neutral-500 mt-2">{product.description}</p>}
      </div>

      {/* grupos — tudo visível, sem recolher */}
      {groups.map((g) => {
        const isRadio = g.max_select === 1;
        const selected = selectedAddons[g.id] ?? [];
        const missing = showErrors && !groupOk(g);
        return (
          <section key={g.id} id={`grupo-${g.id}`} className="-mx-4 sm:mx-0">
            <div className={`px-4 py-3 flex items-center justify-between gap-3 sm:rounded-lg ${missing ? 'bg-red-50' : 'bg-neutral-100'}`}>
              <div>
                <h2 className="font-semibold leading-snug">{g.name}</h2>
                <p className={`text-sm mt-0.5 ${missing ? 'text-red-500 font-semibold' : 'text-neutral-500'}`}>
                  {missing ? 'escolha uma opção para continuar' : groupSubtitle(g)}
                </p>
              </div>
              {g.min_select > 0 ? (
                <span className="bg-brand text-white text-xs font-bold rounded-lg px-2.5 py-1.5 shrink-0">obrigatório</span>
              ) : (
                <span className="text-neutral-400 text-xs shrink-0">opcional</span>
              )}
            </div>
            <div className="px-4 sm:px-1">
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
                      className="w-full flex items-center justify-between gap-3 py-3.5 text-left border-b border-neutral-100 last:border-0"
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={`h-6 w-6 shrink-0 grid place-items-center border-2 text-xs ${
                            isRadio ? 'rounded-full' : 'rounded-md'
                          } ${checked ? 'bg-brand border-brand text-white' : 'border-neutral-300'}`}
                        >
                          {checked && '✓'}
                        </span>
                        {a.name}
                      </span>
                      {Number(a.price) > 0 && (
                        <span className="text-neutral-600 font-medium shrink-0">+{brl(Number(a.price))}</span>
                      )}
                    </button>
                  );
                })}
            </div>
          </section>
        );
      })}

      <div className="py-4">
        <h2 className="font-semibold mb-2">alguma observação?</h2>
        <textarea
          className="input"
          rows={2}
          placeholder="Ex.: sem cebola, ponto da carne..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* barra fixa inferior */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-neutral-200 p-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex items-center border border-neutral-300 rounded-full">
            <button className="px-4 py-2.5 font-bold text-brand text-lg" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
              −
            </button>
            <span className="w-8 text-center font-semibold">{quantity}</span>
            <button className="px-4 py-2.5 font-bold text-brand text-lg" onClick={() => setQuantity((q) => q + 1)}>
              +
            </button>
          </div>
          <button
            className={`flex-1 rounded-full px-4 py-3 font-semibold text-white transition-colors ${
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
