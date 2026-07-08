'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Category } from '@/lib/types';

export default function CategoriesAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');

  const load = async () => {
    const { data } = await supabase.from('categories').select('*').order('sort_order');
    setCategories(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async () => {
    if (!newName.trim()) return;
    await supabase.from('categories').insert({
      name: newName.trim(),
      sort_order: categories.length + 1,
    });
    setNewName('');
    await load();
  };

  const rename = async (id: string, name: string) => {
    if (!name.trim()) return load();
    await supabase.from('categories').update({ name: name.trim() }).eq('id', id);
    await load();
  };

  const toggle = async (cat: Category) => {
    await supabase.from('categories').update({ active: !cat.active }).eq('id', cat.id);
    await load();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= categories.length) return;
    const a = categories[index];
    const b = categories[target];
    await Promise.all([
      supabase.from('categories').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('categories').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta categoria? Os produtos dela ficarão sem categoria.')) return;
    await supabase.from('categories').delete().eq('id', id);
    await load();
  };

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-bold">Categorias</h1>
      <p className="text-xs text-neutral-400 -mt-2">
        Use as setas para definir a ordem em que aparecem no cardápio. Clique no nome para renomear.
      </p>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Nova categoria"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn-brand !py-2" onClick={add}>
          Adicionar
        </button>
      </div>

      {loading ? (
        <p className="text-neutral-400 py-8 text-center">Carregando...</p>
      ) : (
      <div className="card divide-y divide-neutral-100">
        {categories.map((cat, i) => (
          <div key={cat.id} className="p-3 flex items-center gap-2">
            <div className="flex flex-col">
              <button onClick={() => move(i, -1)} className="text-neutral-400 hover:text-brand text-xs leading-none p-0.5">▲</button>
              <button onClick={() => move(i, 1)} className="text-neutral-400 hover:text-brand text-xs leading-none p-0.5">▼</button>
            </div>
            <input
              className={`flex-1 bg-transparent font-medium focus:outline-none ${!cat.active ? 'text-neutral-400 line-through' : ''}`}
              defaultValue={cat.name}
              onBlur={(e) => e.target.value !== cat.name && rename(cat.id, e.target.value)}
            />
            <button
              onClick={() => toggle(cat)}
              className={`text-xs font-semibold rounded-full px-3 py-1 ${
                cat.active ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-500'
              }`}
            >
              {cat.active ? 'Ativa' : 'Inativa'}
            </button>
            <button onClick={() => remove(cat.id)} className="text-xs text-neutral-400 hover:text-red-500 px-1">
              Excluir
            </button>
          </div>
        ))}
        {categories.length === 0 && <p className="p-4 text-sm text-neutral-500">Nenhuma categoria ainda.</p>}
      </div>
      )}
    </div>
  );
}
