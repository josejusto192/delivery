'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Category, Product } from '@/lib/types';

type DraftAddon = { name: string; price: string };
type DraftGroup = { name: string; min: string; max: string; addons: DraftAddon[] };

export default function ProductForm({
  product,
  categories,
  onDone,
}: {
  product: Product | null;
  categories: Category[];
  onDone: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [promoPrice, setPromoPrice] = useState(
    product?.promo_price != null ? String(product.promo_price) : ''
  );
  const [categoryId, setCategoryId] = useState(product?.category_id ?? categories[0]?.id ?? '');
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [groups, setGroups] = useState<DraftGroup[]>(
    (product?.addon_groups ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((g) => ({
        name: g.name,
        min: String(g.min_select),
        max: String(g.max_select),
        addons: (g.addons ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((a) => ({ name: a.name, price: String(a.price) })),
      }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const patchGroup = (gi: number, patch: Partial<DraftGroup>) =>
    setGroups((prev) => prev.map((g, i) => (i === gi ? { ...g, ...patch } : g)));

  const patchAddon = (gi: number, ai: number, patch: Partial<DraftAddon>) =>
    setGroups((prev) =>
      prev.map((g, i) =>
        i === gi
          ? { ...g, addons: g.addons.map((a, j) => (j === ai ? { ...a, ...patch } : a)) }
          : g
      )
    );

  const save = async () => {
    setError('');
    if (!name.trim() || !price) return setError('Nome e preço são obrigatórios.');
    setSaving(true);
    try {
      let finalImageUrl = imageUrl;
      if (imageFile) {
        const path = `${Date.now()}-${imageFile.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
        const { error: upErr } = await supabase.storage.from('products').upload(path, imageFile);
        if (upErr) throw upErr;
        finalImageUrl = supabase.storage.from('products').getPublicUrl(path).data.publicUrl;
      }

      const payload = {
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        promo_price: promoPrice ? Number(promoPrice) : null,
        category_id: categoryId || null,
        featured,
        image_url: finalImageUrl || null,
      };

      let productId = product?.id;
      if (productId) {
        const { error: e } = await supabase.from('products').update(payload).eq('id', productId);
        if (e) throw e;
      } else {
        const { data, error: e } = await supabase.from('products').insert(payload).select('id').single();
        if (e) throw e;
        productId = data.id;
      }

      // recria grupos de adicionais (simples e confiável para o MVP)
      if (product) {
        await supabase.from('addon_groups').delete().eq('product_id', productId);
      }
      for (let gi = 0; gi < groups.length; gi++) {
        const g = groups[gi];
        if (!g.name.trim()) continue;
        const minSel = Math.max(0, Number(g.min) || 0);
        const maxSel = Math.max(1, Number(g.max) || 1, minSel);
        const { data: created, error: ge } = await supabase
          .from('addon_groups')
          .insert({
            product_id: productId,
            name: g.name.trim(),
            min_select: minSel,
            max_select: maxSel,
            sort_order: gi,
          })
          .select('id')
          .single();
        if (ge) throw ge;
        const validAddons = g.addons.filter((a) => a.name.trim());
        if (validAddons.length) {
          const { error: ae } = await supabase.from('addons').insert(
            validAddons.map((a, ai) => ({
              group_id: created.id,
              name: a.name.trim(),
              price: Number(a.price) || 0,
              sort_order: ai,
            }))
          );
          if (ae) throw ae;
        }
      }

      onDone();
    } catch (e) {
      console.error(e);
      setError('Erro ao salvar. Verifique os dados e tente novamente.');
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-lg font-bold">{product ? 'Editar produto' : 'Novo produto'}</h2>

      <div className="card p-4 space-y-3">
        <input className="input" placeholder="Nome do produto" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea className="input" rows={2} placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-neutral-500">
            Preço (R$)
            <input className="input mt-1" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label className="text-xs text-neutral-500">
            Preço promocional &quot;de/por&quot; (opcional)
            <input className="input mt-1" type="number" step="0.01" min="0" placeholder="Ex.: 17,60" value={promoPrice} onChange={(e) => setPromoPrice(e.target.value)} />
          </label>
        </div>
        <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Sem categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          Produto em destaque
        </label>
        <div className="space-y-2">
          <label className="text-sm font-medium">Imagem</label>
          {imageUrl && !imageFile && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
          )}
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} className="text-sm" />
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div>
          <h3 className="font-semibold">Grupos de adicionais e upsell</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Dica: para pergunta tipo &quot;Deseja molho extra?&quot; use mínimo 1 e máximo 1, com opções
            &quot;Sim&quot; (com preço) e &quot;Não&quot; (R$ 0). Para adicionais livres, use mínimo 0.
          </p>
        </div>

        {groups.map((g, gi) => (
          <div key={gi} className="border border-neutral-200 rounded-xl overflow-hidden">
            <div className="bg-neutral-50 p-3 space-y-2.5 border-b border-neutral-200">
              <div className="flex items-center gap-2">
                <input
                  className="input flex-1 !bg-white"
                  placeholder='Pergunta ou nome do grupo — ex.: "Deseja adicionar bacon?"'
                  value={g.name}
                  onChange={(e) => patchGroup(gi, { name: e.target.value })}
                />
                <button
                  type="button"
                  title="Remover grupo"
                  className="h-9 w-9 grid place-items-center rounded-lg border border-neutral-300 bg-white text-neutral-400 hover:text-red-500 hover:border-red-300 shrink-0"
                  onClick={() => setGroups(groups.filter((_, i) => i !== gi))}
                >
                  🗑
                </button>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-neutral-500">
                  Mínimo
                  <input
                    className="input mt-1 !w-20"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={g.min}
                    onChange={(e) => patchGroup(gi, { min: e.target.value })}
                  />
                </label>
                <label className="text-xs text-neutral-500">
                  Máximo
                  <input
                    className="input mt-1 !w-20"
                    type="number"
                    min="1"
                    placeholder="1"
                    value={g.max}
                    onChange={(e) => patchGroup(gi, { max: e.target.value })}
                  />
                </label>
                <p className="text-xs text-neutral-400 flex-1">
                  {Number(g.min) > 0 ? 'Obrigatório' : 'Opcional'} ·{' '}
                  {Number(g.max) === 1 ? 'escolha única (Sim/Não)' : `até ${g.max || 1} opções`}
                </p>
              </div>
            </div>

            <div className="p-3 space-y-2">
              {g.addons.map((a, ai) => (
                <div key={ai} className="flex items-center gap-2">
                  <input
                    className="input flex-1"
                    placeholder={`Opção ${ai + 1} — ex.: Sim / Bacon extra`}
                    value={a.name}
                    onChange={(e) => patchAddon(gi, ai, { name: e.target.value })}
                  />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">R$</span>
                    <input
                      className="input !w-28 !pl-9"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={a.price}
                      onChange={(e) => patchAddon(gi, ai, { price: e.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    title="Remover opção"
                    className="h-9 w-9 grid place-items-center rounded-lg text-neutral-300 hover:text-red-500 shrink-0"
                    onClick={() =>
                      patchGroup(gi, { addons: g.addons.filter((_, j) => j !== ai) })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-sm font-semibold text-brand"
                onClick={() => patchGroup(gi, { addons: [...g.addons, { name: '', price: '' }] })}
              >
                + adicionar opção
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="w-full border-2 border-dashed border-neutral-300 rounded-xl py-3 text-sm font-semibold text-neutral-500 hover:border-brand hover:text-brand transition-colors"
          onClick={() =>
            setGroups([...groups, { name: '', min: '0', max: '1', addons: [{ name: '', price: '' }, { name: '', price: '' }] }])
          }
        >
          + Novo grupo de adicionais
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button className="flex-1 border border-neutral-300 rounded-lg py-3 font-semibold bg-white" onClick={onDone}>
          Cancelar
        </button>
        <button className="btn-brand flex-1" onClick={save} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar produto'}
        </button>
      </div>
    </div>
  );
}
