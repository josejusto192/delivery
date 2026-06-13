'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Address } from '@/lib/types';

const empty = { label: 'Casa', street: '', number: '', complement: '', neighborhood: '', city: '', reference: '' };

export default function AddressesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('addresses').select('*').order('created_at');
    setAddresses(data ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!form.street || !form.number || !form.neighborhood) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('addresses').insert({ ...form, user_id: user.id });
      setForm(empty);
      setShowForm(false);
      await load();
    }
    setSaving(false);
  };

  const remove = async (id: string) => {
    await supabase.from('addresses').delete().eq('id', id);
    await load();
  };

  return (
    <div className="py-8 max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Meus endereços</h1>

      {addresses.map((a) => (
        <div key={a.id} className="card p-4 flex justify-between items-start">
          <div className="text-sm">
            <p className="font-semibold">{a.label}</p>
            <p className="text-neutral-600">
              {a.street}, {a.number}
              {a.complement ? ` — ${a.complement}` : ''}
            </p>
            <p className="text-neutral-500">
              {a.neighborhood}, {a.city}
            </p>
          </div>
          <button onClick={() => remove(a.id)} className="text-xs text-neutral-400 hover:text-red-500">
            Excluir
          </button>
        </div>
      ))}

      {showForm ? (
        <div className="card p-4 space-y-3">
          <input className="input" placeholder="Apelido (Casa, Trabalho...)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <input className="input col-span-2" placeholder="Rua" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
            <input className="input" placeholder="Número" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Bairro" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
            <input className="input" placeholder="Cidade" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Complemento" value={form.complement} onChange={(e) => setForm({ ...form, complement: e.target.value })} />
            <input className="input" placeholder="Referência" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button className="flex-1 border border-neutral-300 rounded-lg py-2.5 font-semibold bg-white" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
            <button className="btn-brand flex-1 !py-2.5" onClick={save} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-brand w-full" onClick={() => setShowForm(true)}>
          + Novo endereço
        </button>
      )}
    </div>
  );
}
