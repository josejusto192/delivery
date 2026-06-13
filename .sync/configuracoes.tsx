'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DAY_KEYS, DAY_LABELS, type DayKey } from '@/lib/storeHours';
import type { StoreSettings } from '@/lib/types';

type DayHours = { enabled: boolean; start: string; end: string };

const WEEK: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export default function SettingsAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [s, setS] = useState<StoreSettings | null>(null);
  const [areas, setAreas] = useState<{ name: string; fee: string }[]>([]);
  const [hours, setHours] = useState<Record<DayKey, DayHours>>(
    Object.fromEntries(
      DAY_KEYS.map((d) => [d, { enabled: false, start: '18:00', end: '23:00' }])
    ) as Record<DayKey, DayHours>
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('store_settings').select('*').single();
      if (data) {
        setS(data);
        setAreas((data.delivery_areas ?? []).map((a: { name: string; fee: number }) => ({ name: a.name, fee: String(a.fee) })));
        const oh = data.opening_hours ?? {};
        setHours(
          Object.fromEntries(
            DAY_KEYS.map((d) => {
              const interval = (oh[d] ?? [])[0];
              return [
                d,
                interval
                  ? { enabled: true, start: interval[0], end: interval[1] }
                  : { enabled: false, start: '18:00', end: '23:00' },
              ];
            })
          ) as Record<DayKey, DayHours>
        );
      }
    })();
  }, [supabase]);

  if (!s) return <p className="text-neutral-400 py-8">Carregando...</p>;

  const set = (patch: Partial<StoreSettings>) => setS({ ...s, ...patch });

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await supabase
      .from('store_settings')
      .update({
        name: s.name,
        logo_url: s.logo_url,
        phone: s.phone,
        whatsapp: s.whatsapp,
        address: s.address,
        brand_color: s.brand_color,
        is_open: s.is_open,
        delivery_fee: Number(s.delivery_fee) || 0,
        min_order: Number(s.min_order) || 0,
        delivery_areas: areas
          .filter((a) => a.name.trim())
          .map((a) => ({ name: a.name.trim(), fee: Number(a.fee) || 0 })),
        opening_hours: Object.fromEntries(
          DAY_KEYS.map((d) => [d, hours[d].enabled ? [[hours[d].start, hours[d].end]] : []])
        ),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-xl space-y-4">
      <div className="card p-4 space-y-3">
        <h3 className="font-semibold">Loja</h3>
        <label className="flex items-center justify-between text-sm font-medium">
          Loja aberta (recebendo pedidos)
          <button
            onClick={() => set({ is_open: !s.is_open })}
            className={`rounded-full px-4 py-1.5 text-xs font-bold ${
              s.is_open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}
          >
            {s.is_open ? 'ABERTA' : 'FECHADA'}
          </button>
        </label>
        <input className="input" placeholder="Nome da loja" value={s.name} onChange={(e) => set({ name: e.target.value })} />
        <input className="input" placeholder="URL do logo" value={s.logo_url ?? ''} onChange={(e) => set({ logo_url: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="Telefone" value={s.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} />
          <input className="input" placeholder="WhatsApp" value={s.whatsapp ?? ''} onChange={(e) => set({ whatsapp: e.target.value })} />
        </div>
        <input className="input" placeholder="Endereço (para retirada)" value={s.address ?? ''} onChange={(e) => set({ address: e.target.value })} />
        <label className="text-sm font-medium flex items-center gap-3">
          Cor da marca
          <input type="color" value={s.brand_color} onChange={(e) => set({ brand_color: e.target.value })} className="h-9 w-16 rounded cursor-pointer" />
        </label>
      </div>

      <div className="card p-4 space-y-3">
        <h3 className="font-semibold">Entrega</h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-neutral-500">
            Taxa de entrega padrão (R$)
            <input className="input mt-1" type="number" step="0.01" value={s.delivery_fee} onChange={(e) => set({ delivery_fee: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-neutral-500">
            Pedido mínimo (R$)
            <input className="input mt-1" type="number" step="0.01" value={s.min_order} onChange={(e) => set({ min_order: Number(e.target.value) })} />
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Áreas de entrega (taxa por região)</p>
            <button className="text-sm font-semibold text-brand" onClick={() => setAreas([...areas, { name: '', fee: '' }])}>
              + Área
            </button>
          </div>
          {areas.map((a, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Bairro / região"
                value={a.name}
                onChange={(e) => setAreas(areas.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <input
                className="input w-28"
                type="number"
                step="0.01"
                placeholder="Taxa"
                value={a.fee}
                onChange={(e) => setAreas(areas.map((x, j) => (j === i ? { ...x, fee: e.target.value } : x)))}
              />
              <button className="text-xs text-neutral-400 hover:text-red-500" onClick={() => setAreas(areas.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}
          <p className="text-xs text-neutral-400">Se nenhuma área for cadastrada, a taxa padrão é aplicada a todos os pedidos.</p>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <h3 className="font-semibold">Horário de funcionamento</h3>
        <p className="text-xs text-neutral-400">
          Fora do horário a loja aparece como fechada e não recebe pedidos, mesmo com a chave
          &quot;ABERTA&quot; ligada. Para horários que passam da meia-noite, use por exemplo 18:00 → 02:00.
          Se nenhum dia for marcado, vale só a chave manual.
        </p>
        <div className="space-y-2">
          {WEEK.map((d) => (
            <div key={d} className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-2 w-28 shrink-0">
                <input
                  type="checkbox"
                  checked={hours[d].enabled}
                  onChange={(e) => setHours({ ...hours, [d]: { ...hours[d], enabled: e.target.checked } })}
                />
                {DAY_LABELS[d]}
              </label>
              {hours[d].enabled ? (
                <>
                  <input
                    type="time"
                    className="input !w-auto"
                    value={hours[d].start}
                    onChange={(e) => setHours({ ...hours, [d]: { ...hours[d], start: e.target.value } })}
                  />
                  <span className="text-neutral-400">→</span>
                  <input
                    type="time"
                    className="input !w-auto"
                    value={hours[d].end}
                    onChange={(e) => setHours({ ...hours, [d]: { ...hours[d], end: e.target.value } })}
                  />
                </>
              ) : (
                <span className="text-neutral-400">Fechado</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <button className="btn-brand w-full" onClick={save} disabled={saving}>
        {saving ? 'Salvando...' : saved ? 'Salvo ✓' : 'Salvar configurações'}
      </button>
    </div>
  );
}
