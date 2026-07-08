'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { brl, formatDateTime } from '@/lib/format';
import type { Product, Promotion } from '@/lib/types';

const DISPLAY_OPTIONS: { value: string; label: string }[] = [
  { value: 'home', label: 'Página inicial' },
  { value: 'produto', label: 'Página do produto' },
  { value: 'carrinho', label: 'Carrinho' },
  { value: 'checkout', label: 'Checkout' },
];

type FormState = {
  id: string | null;
  name: string;
  description: string;
  banner_url: string;
  discount_type: 'percent' | 'fixed';
  discount_value: string;
  display_on: string[];
  starts_at: string;
  ends_at: string;
  product_ids: string[];
};

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  description: '',
  banner_url: '',
  discount_type: 'percent',
  discount_value: '',
  display_on: ['home'],
  starts_at: '',
  ends_at: '',
  product_ids: [],
};

function toDateInput(value: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

export default function PromotionsAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Pick<Product, 'id' | 'name' | 'price' | 'promo_price' | 'active'>[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [{ data: promos }, { data: prods }] = await Promise.all([
      supabase
        .from('promotions')
        .select('*, promotion_products(product_id)')
        .order('created_at', { ascending: false }),
      supabase.from('products').select('id, name, price, promo_price, active').eq('active', true).order('name'),
    ]);
    setPromotions((promos ?? []) as Promotion[]);
    setProducts(prods ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startNew = () => {
    setError('');
    setForm(EMPTY_FORM);
  };

  const startEdit = (p: Promotion) => {
    setError('');
    setForm({
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      banner_url: p.banner_url ?? '',
      discount_type: p.discount_type,
      discount_value: String(p.discount_value ?? ''),
      display_on: p.display_on ?? ['home'],
      starts_at: toDateInput(p.starts_at),
      ends_at: toDateInput(p.ends_at),
      product_ids: (p.promotion_products ?? []).map((pp) => pp.product_id),
    });
  };

  const toggleDisplay = (value: string) => {
    if (!form) return;
    setForm({
      ...form,
      display_on: form.display_on.includes(value)
        ? form.display_on.filter((v) => v !== value)
        : [...form.display_on, value],
    });
  };

  const toggleProduct = (id: string) => {
    if (!form) return;
    setForm({
      ...form,
      product_ids: form.product_ids.includes(id)
        ? form.product_ids.filter((v) => v !== id)
        : [...form.product_ids, id],
    });
  };

  const save = async () => {
    if (!form) return;
    setError('');
    if (!form.name.trim()) return setError('Informe um nome para a promoção.');
    if (!form.discount_value) return setError('Informe o valor do desconto.');
    if (form.display_on.length === 0) return setError('Escolha pelo menos um local de exibição.');

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      banner_url: form.banner_url.trim() || null,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value) || 0,
      display_on: form.display_on,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    };

    let promotionId = form.id;
    if (promotionId) {
      const { error: updateError } = await supabase.from('promotions').update(payload).eq('id', promotionId);
      if (updateError) {
        setSaving(false);
        return setError('Erro ao salvar promoção.');
      }
      await supabase.from('promotion_products').delete().eq('promotion_id', promotionId);
    } else {
      const { data, error: insertError } = await supabase.from('promotions').insert(payload).select('id').single();
      if (insertError || !data) {
        setSaving(false);
        return setError('Erro ao criar promoção.');
      }
      promotionId = data.id;
    }

    if (form.product_ids.length > 0) {
      await supabase
        .from('promotion_products')
        .insert(form.product_ids.map((product_id) => ({ promotion_id: promotionId, product_id })));
    }

    setSaving(false);
    setForm(null);
    await load();
  };

  const toggleActive = async (p: Promotion) => {
    await supabase.from('promotions').update({ active: !p.active }).eq('id', p.id);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta promoção?')) return;
    await supabase.from('promotions').delete().eq('id', id);
    await load();
  };

  if (form) {
    return (
      <div className="max-w-2xl space-y-4">
        <button className="text-sm text-neutral-500 hover:text-neutral-800" onClick={() => setForm(null)}>
          ← Voltar
        </button>
        <div className="card p-4 space-y-3">
          <h3 className="font-semibold">{form.id ? 'Editar promoção' : 'Nova promoção'}</h3>

          <label className="block text-xs text-neutral-500">
            Nome
            <input
              className="input mt-1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: Semana do Hambúrguer"
            />
          </label>

          <label className="block text-xs text-neutral-500">
            Descrição
            <textarea
              className="input mt-1"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>

          <label className="block text-xs text-neutral-500">
            URL do banner (opcional)
            <input
              className="input mt-1"
              value={form.banner_url}
              onChange={(e) => setForm({ ...form, banner_url: e.target.value })}
              placeholder="https://..."
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-neutral-500">
              Tipo de desconto
              <select
                className="input mt-1"
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'percent' | 'fixed' })}
              >
                <option value="percent">% Percentual</option>
                <option value="fixed">R$ Valor fixo</option>
              </select>
            </label>
            <label className="text-xs text-neutral-500">
              {form.discount_type === 'percent' ? 'Desconto (%)' : 'Desconto (R$)'}
              <input
                className="input mt-1"
                type="number"
                step="0.01"
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-neutral-500">
              Início (opcional)
              <input
                className="input mt-1"
                type="date"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              />
            </label>
            <label className="text-xs text-neutral-500">
              Fim (opcional)
              <input
                className="input mt-1"
                type="date"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
              />
            </label>
          </div>

          <div>
            <p className="text-xs text-neutral-500 mb-1">Onde exibir</p>
            <div className="flex flex-wrap gap-2">
              {DISPLAY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleDisplay(opt.value)}
                  className={`text-xs font-medium rounded-full px-3 py-1.5 border transition-colors ${
                    form.display_on.includes(opt.value)
                      ? 'bg-brand text-white border-brand'
                      : 'border-neutral-300 text-neutral-600 hover:border-neutral-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-neutral-500 mb-1">Produtos participantes ({form.product_ids.length} selecionados)</p>
            <div className="border border-neutral-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-neutral-100">
              {products.map((p) => (
                <label key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-neutral-50">
                  <input
                    type="checkbox"
                    checked={form.product_ids.includes(p.id)}
                    onChange={() => toggleProduct(p.id)}
                  />
                  <span className="flex-1">{p.name}</span>
                  <span className="text-neutral-400">{brl(Number(p.promo_price ?? p.price))}</span>
                </label>
              ))}
              {products.length === 0 && <p className="px-3 py-2 text-sm text-neutral-500">Nenhum produto ativo.</p>}
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          <button className="btn-brand !py-2" onClick={save} disabled={saving}>
            {saving ? 'Salvando...' : form.id ? 'Salvar alterações' : 'Criar promoção'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold mr-auto">Promoções</h1>
        <button className="btn-brand !py-2" onClick={startNew}>
          + Nova promoção
        </button>
      </div>

      <div className="card divide-y divide-neutral-100">
        {promotions.map((p) => (
          <div key={p.id} className="p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{p.name}</p>
              <p className="text-xs text-neutral-500">
                {p.discount_type === 'percent' ? `${Number(p.discount_value)}% de desconto` : `${brl(Number(p.discount_value))} de desconto`}
                {' · '}
                {(p.promotion_products ?? []).length} produto(s)
                {' · '}
                {(p.display_on ?? []).map((d) => DISPLAY_OPTIONS.find((o) => o.value === d)?.label ?? d).join(', ')}
                {p.starts_at && ` · de ${formatDateTime(p.starts_at)}`}
                {p.ends_at && ` até ${formatDateTime(p.ends_at)}`}
              </p>
            </div>
            <button
              onClick={() => toggleActive(p)}
              className={`text-xs font-semibold rounded-full px-3 py-1 shrink-0 ${
                p.active ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-500'
              }`}
            >
              {p.active ? 'Ativa' : 'Inativa'}
            </button>
            <button onClick={() => startEdit(p)} className="text-xs text-neutral-400 hover:text-neutral-800 px-1 shrink-0">
              Editar
            </button>
            <button onClick={() => remove(p.id)} className="text-xs text-neutral-400 hover:text-red-500 px-1 shrink-0">
              Excluir
            </button>
          </div>
        ))}
        {promotions.length === 0 && <p className="p-4 text-sm text-neutral-500">Nenhuma promoção criada ainda.</p>}
      </div>
    </div>
  );
}
