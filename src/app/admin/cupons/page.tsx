'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { brl, formatDateTime } from '@/lib/format';
import type { Coupon } from '@/lib/types';

type CouponType = Coupon['type'];

const TYPE_LABELS: Record<CouponType, string> = {
  percent: '% Percentual',
  fixed: 'R$ Valor fixo',
  free_delivery: 'Entrega grátis',
};

type FormState = {
  code: string;
  type: CouponType;
  value: string;
  min_order: string;
  max_uses: string;
  expires_at: string;
};

const EMPTY_FORM: FormState = {
  code: '',
  type: 'percent',
  value: '',
  min_order: '0',
  max_uses: '',
  expires_at: '',
};

export default function CouponsAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    setCoupons(data ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    setError('');
    const code = form.code.trim().toUpperCase();
    if (!code) return setError('Informe um código para o cupom.');
    if (form.type !== 'free_delivery' && !form.value) return setError('Informe o valor do desconto.');

    setSaving(true);
    const { error: insertError } = await supabase.from('coupons').insert({
      code,
      type: form.type,
      value: form.type === 'free_delivery' ? 0 : Number(form.value) || 0,
      min_order: Number(form.min_order) || 0,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      active: true,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.code === '23505' ? 'Já existe um cupom com esse código.' : 'Erro ao criar cupom.');
      return;
    }
    setForm(EMPTY_FORM);
    await load();
  };

  const toggle = async (coupon: Coupon) => {
    await supabase.from('coupons').update({ active: !coupon.active }).eq('id', coupon.id);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este cupom?')) return;
    await supabase.from('coupons').delete().eq('id', id);
    await load();
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="card p-4 space-y-3">
        <h3 className="font-semibold">Novo cupom</h3>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="input uppercase"
            placeholder="Código (ex.: PROMO10)"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <select
            className="input"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as CouponType })}
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {form.type !== 'free_delivery' && (
            <label className="text-xs text-neutral-500">
              {form.type === 'percent' ? 'Desconto (%)' : 'Desconto (R$)'}
              <input
                className="input mt-1"
                type="number"
                step="0.01"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </label>
          )}
          <label className="text-xs text-neutral-500">
            Pedido mínimo (R$)
            <input
              className="input mt-1"
              type="number"
              step="0.01"
              value={form.min_order}
              onChange={(e) => setForm({ ...form, min_order: e.target.value })}
            />
          </label>
          <label className="text-xs text-neutral-500">
            Limite de usos (opcional)
            <input
              className="input mt-1"
              type="number"
              value={form.max_uses}
              onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
            />
          </label>
          <label className="text-xs text-neutral-500">
            Expira em (opcional)
            <input
              className="input mt-1"
              type="date"
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
            />
          </label>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button className="btn-brand !py-2" onClick={create} disabled={saving}>
          {saving ? 'Criando...' : 'Criar cupom'}
        </button>
      </div>

      <div className="card divide-y divide-neutral-100">
        {coupons.map((c) => (
          <div key={c.id} className="p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{c.code}</p>
              <p className="text-xs text-neutral-500">
                {c.type === 'percent' && `${Number(c.value)}% de desconto`}
                {c.type === 'fixed' && `${brl(Number(c.value))} de desconto`}
                {c.type === 'free_delivery' && 'Entrega grátis'}
                {Number(c.min_order) > 0 && ` · mínimo ${brl(Number(c.min_order))}`}
                {c.max_uses != null && ` · usado ${c.used_count}/${c.max_uses}`}
                {c.expires_at && ` · expira em ${formatDateTime(c.expires_at)}`}
              </p>
            </div>
            <button
              onClick={() => toggle(c)}
              className={`text-xs font-semibold rounded-full px-3 py-1 shrink-0 ${
                c.active ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-500'
              }`}
            >
              {c.active ? 'Ativo' : 'Inativo'}
            </button>
            <button onClick={() => remove(c.id)} className="text-xs text-neutral-400 hover:text-red-500 px-1 shrink-0">
              Excluir
            </button>
          </div>
        ))}
        {coupons.length === 0 && <p className="p-4 text-sm text-neutral-500">Nenhum cupom criado ainda.</p>}
      </div>
    </div>
  );
}
