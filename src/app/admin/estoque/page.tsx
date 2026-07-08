'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Ingredient, StoreSettings } from '@/lib/types';

type Draft = {
  name: string;
  unit: 'un' | 'kg';
  cost_per_unit: string;
  stock_quantity: string;
  min_stock: string;
};

const emptyDraft: Draft = { name: '', unit: 'kg', cost_per_unit: '', stock_quantity: '', min_stock: '' };

function unitLabel(unit: 'un' | 'kg') {
  return unit === 'kg' ? 'kg' : 'un';
}

export default function EstoqueAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [marginInput, setMarginInput] = useState('');
  const [savingMargin, setSavingMargin] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [{ data: ing }, { data: s }] = await Promise.all([
      supabase.from('ingredients').select('*').order('name'),
      supabase.from('store_settings').select('*').single(),
    ]);
    setIngredients(ing ?? []);
    if (s) {
      setSettings(s);
      setMarginInput(String(s.default_margin_percent));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = (i: Ingredient) => {
    setEditingId(i.id);
    setDraft({
      name: i.name,
      unit: i.unit,
      cost_per_unit: String(i.cost_per_unit),
      stock_quantity: String(i.stock_quantity),
      min_stock: String(i.min_stock),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setError('');
  };

  const save = async () => {
    setError('');
    if (!draft.name.trim()) return setError('Informe o nome do insumo.');
    const payload = {
      name: draft.name.trim(),
      unit: draft.unit,
      cost_per_unit: Number(draft.cost_per_unit) || 0,
      stock_quantity: Number(draft.stock_quantity) || 0,
      min_stock: Number(draft.min_stock) || 0,
    };
    const { error: e } = editingId
      ? await supabase.from('ingredients').update(payload).eq('id', editingId)
      : await supabase.from('ingredients').insert(payload);
    if (e) {
      setError('Erro ao salvar. Tente novamente.');
      return;
    }
    cancelEdit();
    await load();
  };

  const toggleActive = async (i: Ingredient) => {
    await supabase.from('ingredients').update({ active: !i.active }).eq('id', i.id);
    await load();
  };

  const remove = async (i: Ingredient) => {
    if (!confirm(`Excluir o insumo "${i.name}"? Ele será removido de qualquer ficha técnica que o utilize.`)) return;
    await supabase.from('ingredients').delete().eq('id', i.id);
    await load();
  };

  const saveMargin = async () => {
    setSavingMargin(true);
    await supabase
      .from('store_settings')
      .update({ default_margin_percent: Number(marginInput) || 0 })
      .eq('id', 1);
    setSavingMargin(false);
    await load();
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="card p-4 space-y-2">
        <h3 className="font-semibold">Margem de lucro padrão</h3>
        <p className="text-xs text-neutral-400">
          Usada para sugerir o preço de venda de cada produto do cardápio a partir do custo dos insumos.
          Pode ser sobrescrita individualmente em cada produto.
        </p>
        <div className="flex items-center gap-2">
          <div className="relative w-32">
            <input
              className="input !pr-8"
              type="number"
              step="0.1"
              min="0"
              max="95"
              value={marginInput}
              onChange={(e) => setMarginInput(e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">%</span>
          </div>
          <button className="btn-brand !py-2" onClick={saveMargin} disabled={savingMargin}>
            {savingMargin ? 'Salvando...' : 'Salvar margem'}
          </button>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <h3 className="font-semibold">{editingId ? 'Editar insumo' : 'Novo insumo'}</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            className="input sm:col-span-2"
            placeholder="Nome do insumo — ex.: Carne bovina, Pão de hambúrguer"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <label className="text-xs text-neutral-500">
            Comprado por
            <select
              className="input mt-1"
              value={draft.unit}
              onChange={(e) => setDraft({ ...draft, unit: e.target.value as 'un' | 'kg' })}
            >
              <option value="kg">Quilograma (kg)</option>
              <option value="un">Unidade</option>
            </select>
          </label>
          <label className="text-xs text-neutral-500">
            Valor pago por {unitLabel(draft.unit)} (R$)
            <input
              className="input mt-1"
              type="number"
              step="0.0001"
              min="0"
              placeholder="0,00"
              value={draft.cost_per_unit}
              onChange={(e) => setDraft({ ...draft, cost_per_unit: e.target.value })}
            />
          </label>
          <label className="text-xs text-neutral-500">
            Quantidade em estoque ({unitLabel(draft.unit)})
            <input
              className="input mt-1"
              type="number"
              step="0.001"
              min="0"
              value={draft.stock_quantity}
              onChange={(e) => setDraft({ ...draft, stock_quantity: e.target.value })}
            />
          </label>
          <label className="text-xs text-neutral-500">
            Estoque mínimo ({unitLabel(draft.unit)})
            <input
              className="input mt-1"
              type="number"
              step="0.001"
              min="0"
              value={draft.min_stock}
              onChange={(e) => setDraft({ ...draft, min_stock: e.target.value })}
            />
          </label>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2">
          {editingId && (
            <button className="border border-neutral-300 rounded-lg px-4 py-2 text-sm font-semibold bg-white" onClick={cancelEdit}>
              Cancelar
            </button>
          )}
          <button className="btn-brand !py-2" onClick={save}>
            {editingId ? 'Salvar alterações' : '+ Adicionar insumo'}
          </button>
        </div>
      </div>

      <div className="card divide-y divide-neutral-100">
        {ingredients.map((i) => {
          const low = i.stock_quantity <= i.min_stock && i.min_stock > 0;
          return (
            <div key={i.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${!i.active ? 'text-neutral-400 line-through' : ''}`}>
                  {i.name}
                </p>
                <p className="text-sm text-neutral-500">
                  R$ {Number(i.cost_per_unit).toFixed(4)} / {unitLabel(i.unit)} · Estoque: {i.stock_quantity}{' '}
                  {unitLabel(i.unit)}
                  {low && <span className="text-amber-600 font-semibold ml-1">· baixo</span>}
                </p>
              </div>
              <button
                onClick={() => toggleActive(i)}
                className={`text-xs font-semibold rounded-full px-3 py-1 ${
                  i.active ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-500'
                }`}
              >
                {i.active ? 'Ativo' : 'Pausado'}
              </button>
              <button onClick={() => startEdit(i)} className="text-sm font-semibold text-brand px-2">
                Editar
              </button>
              <button onClick={() => remove(i)} className="text-xs text-neutral-400 hover:text-red-500">
                Excluir
              </button>
            </div>
          );
        })}
        {ingredients.length === 0 && <p className="p-4 text-sm text-neutral-500">Nenhum insumo cadastrado.</p>}
      </div>
    </div>
  );
}
