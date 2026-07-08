'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { brl } from '@/lib/format';
import type { Category, Ingredient, Product } from '@/lib/types';

type DraftAddon = { name: string; price: string };
type DraftGroup = { name: string; min: string; max: string; addons: DraftAddon[] };
type DraftRecipeItem = { ingredientId: string; quantity: string };

export default function ProductForm({
  product,
  categories,
  ingredients,
  defaultMarginPercent,
  onDone,
}: {
  product: Product | null;
  categories: Category[];
  ingredients: Ingredient[];
  defaultMarginPercent: number;
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
  const [recipe, setRecipe] = useState<DraftRecipeItem[]>(
    (product?.product_ingredients ?? []).map((pi) => ({
      ingredientId: pi.ingredient_id,
      quantity: String(pi.quantity),
    }))
  );
  const [marginOverride, setMarginOverride] = useState(
    product?.margin_percent != null ? String(product.margin_percent) : ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const ingredientById = useMemo(
    () => new Map(ingredients.map((i) => [i.id, i])),
    [ingredients]
  );

  const costPrice = useMemo(
    () =>
      recipe.reduce((sum, item) => {
        const ing = ingredientById.get(item.ingredientId);
        const qty = Number(item.quantity) || 0;
        return sum + (ing ? qty * Number(ing.cost_per_unit) : 0);
      }, 0),
    [recipe, ingredientById]
  );

  const marginNumber = marginOverride !== '' ? Number(marginOverride) : defaultMarginPercent;
  const effectiveMargin = Number.isFinite(marginNumber) ? Math.min(95, Math.max(0, marginNumber)) : defaultMarginPercent;
  const suggestedPrice = costPrice / (1 - effectiveMargin / 100);

  const patchRecipeItem = (idx: number, patch: Partial<DraftRecipeItem>) =>
    setRecipe((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

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
        cost_price: costPrice,
        margin_percent: marginOverride !== '' ? Number(marginOverride) : null,
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

      // recria a ficha técnica (insumos usados neste produto)
      if (product) {
        await supabase.from('product_ingredients').delete().eq('product_id', productId);
      }
      const validRecipe = recipe.filter((r) => r.ingredientId && Number(r.quantity) > 0);
      if (validRecipe.length) {
        const { error: re } = await supabase.from('product_ingredients').insert(
          validRecipe.map((r) => ({
            product_id: productId,
            ingredient_id: r.ingredientId,
            quantity: Number(r.quantity),
          }))
        );
        if (re) throw re;
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
          <h3 className="font-semibold">Ficha técnica (custo dos insumos)</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Selecione os insumos e a quantidade exata usada neste produto. O custo e o preço sugerido são
            calculados automaticamente.
          </p>
        </div>

        {ingredients.length === 0 ? (
          <p className="text-sm text-neutral-400">
            Nenhum insumo cadastrado ainda. Cadastre insumos em Estoque para montar a ficha técnica.
          </p>
        ) : (
          <div className="space-y-2">
            {recipe.map((r, ri) => {
              const ing = ingredientById.get(r.ingredientId);
              const qty = Number(r.quantity) || 0;
              const lineCost = ing ? qty * Number(ing.cost_per_unit) : 0;
              const gramsHint =
                ing?.unit === 'kg' && qty > 0
                  ? `= ${qty >= 1 ? `${qty.toLocaleString('pt-BR')} kg` : `${Math.round(qty * 1000)} g`}`
                  : '';
              return (
                <div key={ri}>
                  <div className="flex items-center gap-2">
                    <select
                      className="input flex-1"
                      value={r.ingredientId}
                      onChange={(e) => patchRecipeItem(ri, { ingredientId: e.target.value })}
                    >
                      <option value="">Selecione o insumo</option>
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.unit === 'kg' ? 'kg' : 'un'})
                        </option>
                      ))}
                    </select>
                    <div className="relative">
                      <input
                        className="input !w-28 !pr-9"
                        type="number"
                        step="0.001"
                        min="0"
                        placeholder={ing?.unit === 'kg' ? '0,150' : 'Qtd.'}
                        value={r.quantity}
                        onChange={(e) => patchRecipeItem(ri, { quantity: e.target.value })}
                      />
                      {ing && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
                          {ing.unit}
                        </span>
                      )}
                    </div>
                    <span className="w-20 shrink-0 text-right text-xs text-neutral-500">
                      {ing ? brl(lineCost) : ''}
                    </span>
                    <button
                      type="button"
                      title="Remover insumo"
                      className="h-9 w-9 grid place-items-center rounded-lg text-neutral-300 hover:text-red-500 shrink-0"
                      onClick={() => setRecipe(recipe.filter((_, i) => i !== ri))}
                    >
                      ×
                    </button>
                  </div>
                  {gramsHint && (
                    <p className={`text-[11px] mt-0.5 ml-1 ${qty > 3 ? 'text-red-500 font-semibold' : 'text-neutral-400'}`}>
                      {gramsHint}
                      {qty > 3 && ' — quantidade alta! Lembre: a medida é em kg (150 g = 0,150)'}
                    </p>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              className="text-sm font-semibold text-brand"
              onClick={() => setRecipe([...recipe, { ingredientId: '', quantity: '' }])}
            >
              + adicionar insumo
            </button>
          </div>
        )}

        <div className="border-t border-neutral-100 pt-3 space-y-2.5">
          <label className="text-xs text-neutral-500 block">
            Margem de lucro para este produto (deixe em branco para usar a padrão de {defaultMarginPercent}%)
            <div className="relative mt-1 w-32">
              <input
                className="input !pr-8"
                type="number"
                step="0.1"
                min="0"
                max="95"
                placeholder={String(defaultMarginPercent)}
                value={marginOverride}
                onChange={(e) => setMarginOverride(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">%</span>
            </div>
          </label>

          <div className="bg-neutral-50 rounded-lg p-3 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs text-neutral-500">Custo do produto</p>
              <p className="font-bold">{brl(costPrice)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Preço sugerido (margem {effectiveMargin}%)</p>
              <p className="font-bold text-brand">{brl(suggestedPrice)}</p>
            </div>
            <button
              type="button"
              className="text-sm font-semibold text-brand underline underline-offset-2"
              onClick={() => setPrice(suggestedPrice.toFixed(2))}
              disabled={costPrice <= 0}
            >
              Usar preço sugerido
            </button>
          </div>
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
