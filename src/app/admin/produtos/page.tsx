'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { brl } from '@/lib/format';
import type { Category, Product } from '@/lib/types';
import ProductForm from '@/components/admin/ProductForm';

export default function ProductsAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);

  const load = async () => {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('products').select('*, addon_groups(*, addons(*))').order('sort_order'),
      supabase.from('categories').select('*').order('sort_order'),
    ]);
    setProducts((prods ?? []) as Product[]);
    setCategories(cats ?? []);
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

  if (editing) {
    return (
      <ProductForm
        product={editing === 'new' ? null : editing}
        categories={categories}
        onDone={async () => {
          setEditing(null);
          await load();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <button className="btn-brand" onClick={() => setEditing('new')}>
        + Novo produto
      </button>

      <div className="card divide-y divide-neutral-100">
        {products.map((p) => (
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
              <p className="text-sm text-neutral-500">
                {brl(Number(p.price))} · {categories.find((c) => c.id === p.category_id)?.name ?? 'Sem categoria'}
              </p>
            </div>
            <button
              onClick={() => toggleActive(p)}
              className={`text-xs font-semibold rounded-full px-3 py-1 ${
                p.active ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-500'
              }`}
            >
              {p.active ? 'Ativo' : 'Pausado'}
            </button>
            <button onClick={() => setEditing(p)} className="text-sm font-semibold text-brand px-2">
              Editar
            </button>
            <button onClick={() => remove(p)} className="text-xs text-neutral-400 hover:text-red-500">
              Excluir
            </button>
          </div>
        ))}
        {products.length === 0 && <p className="p-4 text-sm text-neutral-500">Nenhum produto cadastrado.</p>}
      </div>
    </div>
  );
}
