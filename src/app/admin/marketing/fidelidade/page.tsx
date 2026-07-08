'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { brl } from '@/lib/format';
import type { LoyaltyReward, LoyaltySettings, Product } from '@/lib/types';

const TYPE_LABELS: Record<LoyaltyReward['type'], string> = {
  discount_percent: '% Desconto percentual',
  discount_fixed: 'R$ Desconto fixo',
  free_product: 'Produto grátis',
};

type RewardForm = {
  name: string;
  description: string;
  points_cost: string;
  type: LoyaltyReward['type'];
  value: string;
  product_id: string;
};

const EMPTY_REWARD: RewardForm = {
  name: '',
  description: '',
  points_cost: '',
  type: 'discount_fixed',
  value: '',
  product_id: '',
};

export default function LoyaltyAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [settings, setSettings] = useState<LoyaltySettings | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [products, setProducts] = useState<Pick<Product, 'id' | 'name' | 'price' | 'promo_price' | 'active' | 'loyalty_points'>[]>([]);
  const [form, setForm] = useState<RewardForm>(EMPTY_REWARD);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingReward, setSavingReward] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [{ data: s }, { data: r }, { data: p }] = await Promise.all([
      supabase.from('loyalty_settings').select('*').eq('id', 1).single(),
      supabase.from('loyalty_rewards').select('*').order('points_cost'),
      supabase.from('products').select('id, name, price, promo_price, active, loyalty_points').order('name'),
    ]);
    setSettings(s ?? null);
    setRewards((r ?? []) as LoyaltyReward[]);
    setProducts(p ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    await supabase
      .from('loyalty_settings')
      .update({
        enabled: settings.enabled,
        points_per_currency: settings.points_per_currency,
        min_order_to_earn: settings.min_order_to_earn,
      })
      .eq('id', 1);
    setSavingSettings(false);
  };

  const updateProductPoints = async (productId: string, value: string) => {
    const points = value.trim() === '' ? null : Number(value);
    await supabase.from('products').update({ loyalty_points: points }).eq('id', productId);
    await load();
  };

  const createReward = async () => {
    setError('');
    if (!form.name.trim()) return setError('Informe um nome para a recompensa.');
    if (!form.points_cost) return setError('Informe o custo em pontos.');
    if (form.type !== 'free_product' && !form.value) return setError('Informe o valor do desconto.');
    if (form.type === 'free_product' && !form.product_id) return setError('Escolha o produto grátis.');

    setSavingReward(true);
    const { error: insertError } = await supabase.from('loyalty_rewards').insert({
      name: form.name.trim(),
      description: form.description.trim() || null,
      points_cost: Number(form.points_cost) || 0,
      type: form.type,
      value: form.type === 'free_product' ? 0 : Number(form.value) || 0,
      product_id: form.type === 'free_product' ? form.product_id : null,
      active: true,
    });
    setSavingReward(false);
    if (insertError) return setError('Erro ao criar recompensa.');
    setForm(EMPTY_REWARD);
    await load();
  };

  const toggleReward = async (reward: LoyaltyReward) => {
    await supabase.from('loyalty_rewards').update({ active: !reward.active }).eq('id', reward.id);
    await load();
  };

  const removeReward = async (id: string) => {
    if (!confirm('Excluir esta recompensa?')) return;
    await supabase.from('loyalty_rewards').delete().eq('id', id);
    await load();
  };

  if (!settings) return <p className="text-neutral-400 py-8 text-center">Carregando...</p>;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">Programa de fidelidade</h1>
      <div className="card p-4 space-y-3">
        <h3 className="font-semibold">Configuração do programa de fidelidade</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
          />
          Ativar programa de fidelidade
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-neutral-500">
            Pontos por R$1 gasto
            <input
              className="input mt-1"
              type="number"
              step="0.01"
              value={settings.points_per_currency}
              onChange={(e) => setSettings({ ...settings, points_per_currency: Number(e.target.value) })}
            />
          </label>
          <label className="text-xs text-neutral-500">
            Pedido mínimo para pontuar (R$)
            <input
              className="input mt-1"
              type="number"
              step="0.01"
              value={settings.min_order_to_earn}
              onChange={(e) => setSettings({ ...settings, min_order_to_earn: Number(e.target.value) })}
            />
          </label>
        </div>
        <button className="btn-brand !py-2" onClick={saveSettings} disabled={savingSettings}>
          {savingSettings ? 'Salvando...' : 'Salvar configuração'}
        </button>
      </div>

      <div className="card p-4 space-y-2">
        <h3 className="font-semibold">Pontuação por produto</h3>
        <p className="text-xs text-neutral-500">
          Deixe em branco para usar o cálculo padrão (preço × pontos por R$1). Defina um valor para sobrescrever.
        </p>
        <div className="divide-y divide-neutral-100 max-h-72 overflow-y-auto">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2">
              <span className="flex-1 text-sm">{p.name}</span>
              <span className="text-xs text-neutral-400">{brl(Number(p.promo_price ?? p.price))}</span>
              <input
                className="input w-24 !py-1"
                type="number"
                step="0.01"
                placeholder="auto"
                defaultValue={p.loyalty_points ?? ''}
                onBlur={(e) => updateProductPoints(p.id, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <h3 className="font-semibold">Nova recompensa</h3>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="input"
            placeholder="Nome da recompensa"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="input"
            type="number"
            placeholder="Custo em pontos"
            value={form.points_cost}
            onChange={(e) => setForm({ ...form, points_cost: e.target.value })}
          />
        </div>
        <textarea
          className="input"
          rows={2}
          placeholder="Descrição (opcional)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            className="input"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as LoyaltyReward['type'] })}
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {form.type === 'free_product' ? (
            <select
              className="input"
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
            >
              <option value="">Selecione o produto</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              type="number"
              step="0.01"
              placeholder={form.type === 'discount_percent' ? 'Desconto (%)' : 'Desconto (R$)'}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          )}
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button className="btn-brand !py-2" onClick={createReward} disabled={savingReward}>
          {savingReward ? 'Criando...' : 'Criar recompensa'}
        </button>
      </div>

      <div className="card divide-y divide-neutral-100">
        {rewards.map((r) => (
          <div key={r.id} className="p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{r.name}</p>
              <p className="text-xs text-neutral-500">
                {r.points_cost} pontos ·{' '}
                {r.type === 'discount_percent' && `${Number(r.value)}% de desconto`}
                {r.type === 'discount_fixed' && `${brl(Number(r.value))} de desconto`}
                {r.type === 'free_product' && `Produto grátis: ${products.find((p) => p.id === r.product_id)?.name ?? '—'}`}
              </p>
            </div>
            <button
              onClick={() => toggleReward(r)}
              className={`text-xs font-semibold rounded-full px-3 py-1 shrink-0 ${
                r.active ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-500'
              }`}
            >
              {r.active ? 'Ativa' : 'Inativa'}
            </button>
            <button onClick={() => removeReward(r.id)} className="text-xs text-neutral-400 hover:text-red-500 px-1 shrink-0">
              Excluir
            </button>
          </div>
        ))}
        {rewards.length === 0 && <p className="p-4 text-sm text-neutral-500">Nenhuma recompensa criada ainda.</p>}
      </div>
    </div>
  );
}
