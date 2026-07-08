'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { brl } from '@/lib/format';
import type { Category, Ingredient, Product, StoreSettings } from '@/lib/types';
import ProductForm from '@/components/admin/ProductForm';

export default function ProductsAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const load = async () => {
    const [{ data: prods }, { data: cats }, { data: ings }, { data: s }] = await Promise.all([
      supabase
        .from('products')
        .select('*, addon_groups(*, addons(*)), product_ingredients(*, ingredient:ingredients(*))')
        .order('sort_order'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('ingredients').select('*').eq('active', true).order('name'),
      supabase.from('store_settings').select('*').single(),
    ]);
    setProducts((prods ?? []) as Product[]);
    setCategories(cats ?? []);
    setIngredients(ings ?? []);
    setSettings(s ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleActive = async (p: Product) => {
    await supabase.from('products').update({ active: !p.active }).eq('id', p.id);
    await load();
  };

  const remove = async (p: Product) => {
    if (!confirm(`Excluir "${p.name}"?`)) return;
    await supabase.from('products').delete().eq('id', p.id);
    await load();
  };

  const visible = useMemo(() => {
    let list = products;
    if (categoryFilter === 'none') list = list.filter((p) => !p.category_id);
    else if (categoryFilter !== 'all') list = list.filter((p) => p.category_id === categoryFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, categoryFilter, search]);

  if (editing) {
    return (
      <ProductForm
        product={editing === 'new' ? null : editing}
        categories={categories}
        ingredients={ingredients}
        defaultMarginPercent={settings?.default_margin_percent ?? 30}
        onDone={async () => {
          setEditing(null);
          await load();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold mr-auto">Produtos</h1>
        <button className="btn-brand !py-2" onClick={() => setEditing('new')}>
          + Novo produto
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          className="input sm:max-w-xs"
          placeholder="Buscar produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <FilterChip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} label="Todas" />
          {categories.map((c) => (
            <FilterChip
              key={c.id}
              active={categoryFilter === c.id}
              onClick={() => setCategoryFilter(c.id)}
              label={c.name}
            />
          ))}
          <FilterChip active={categoryFilter === 'none'} onClick={() => setCategoryFilter('none')} label="Sem categoria" />
        </div>
      </div>

      {loading ? (
        <p className="text-neutral-400 py-8 text-center">Carregando...</p>
      ) : (
        <div className="card divide-y divide-neutral-100">
          {visible.map((p) => {
            const cost = Number(p.cost_price) || 0;
            const price = Number(p.price);
            const belowCost = cost > 0 && price < cost;
            const marginReal = cost > 0 && price > 0 ? ((price - cost) / price) * 100 : null;
            return (
              <div key={p.id} className="p-3 flex items-center gap-3">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-neutral-100 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${!p.active ? 'text-neutral-400 line-through' : ''}`}>
                    {p.name} {p.featured && <span className="text-amber-500">★</span>}
                  </p>
                  <p className="text-sm text-neutral-500 truncate">
                    {brl(price)} · {categories.find((c) => c.id === p.category_id)?.name ?? 'Sem categoria'}
                    {cost > 0 && (
                      <span className="text-xs">
                        {' '}· custo {brl(cost)}
                        {marginReal != null && !belowCost && ` · margem ${marginReal.toFixed(0)}%`}
                      </span>
                    )}
                  </p>
                  {belowCost && (
                    <p className="text-xs font-semibold text-red-500">⚠️ Preço abaixo do custo dos insumos</p>
                  )}
                </div>
                <button
                  onClick={() => toggleActive(p)}
                  className={`text-xs font-semibold rounded-full px-3 py-1 shrink-0 ${
                    p.active ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-500'
                  }`}
                >
                  {p.active ? 'Ativo' : 'Pausado'}
                </button>
                <button onClick={() => setEditing(p)} className="text-sm font-semibold text-brand px-2 shrink-0">
                  Editar
                </button>
                <button onClick={() => remove(p)} className="text-xs text-neutral-400 hover:text-red-500 shrink-0">
                  Excluir
                </button>
              </div>
            );
          })}
          {visible.length === 0 && (
            <p className="p-4 text-sm text-neutral-500">
              {products.length === 0
                ? 'Nenhum produto cadastrado. Clique em "+ Novo produto" para começar.'
                : 'Nenhum produto encontrado com esse filtro.'}
            </p>
          )}
        </div>
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
