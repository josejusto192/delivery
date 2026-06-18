'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { brl } from '@/lib/format';
import { printOrder } from '@/lib/print';
import ProductPickerModal from '@/components/admin/ProductPickerModal';
import type { Category, Order, Product } from '@/lib/types';

const TABLE_COUNT = 12;

type ClientSuggestion = { id: string; name: string; whatsapp: string | null };

export default function TablesBoard({ products, categories }: { products: Product[]; categories: Category[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [tabs, setTabs] = useState<Order[]>([]);
  const [activeTableNumber, setActiveTableNumber] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [closing, setClosing] = useState(false);
  const [closePayment, setClosePayment] = useState<'pix' | 'card' | 'cash'>('cash');
  const [closeChangeFor, setCloseChangeFor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('status', 'open_tab')
      .order('table_number');
    setTabs((data ?? []) as Order[]);
  }, [supabase]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('tables-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: 'fulfillment=eq.dine_in' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  const activeTab = activeTableNumber != null ? tabs.find((t) => t.table_number === activeTableNumber) ?? null : null;

  useEffect(() => {
    setNameDraft(activeTab && !activeTab.customer_name.startsWith('Mesa ') ? activeTab.customer_name : '');
    setSuggestions([]);
    setShowSuggestions(false);
  }, [activeTab?.id]);

  useEffect(() => {
    const q = nameDraft.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id,name,whatsapp').ilike('name', `%${q}%`).limit(6);
      setSuggestions((data ?? []) as ClientSuggestion[]);
    }, 250);
    return () => clearTimeout(timeout);
  }, [nameDraft, supabase]);

  const saveName = async (client?: ClientSuggestion) => {
    if (!activeTab) return;
    const name = client?.name ?? nameDraft.trim() ?? '';
    setShowSuggestions(false);
    setSavingName(true);
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        customer_name: name || `Mesa ${activeTab.table_number}`,
        user_id: client?.id ?? activeTab.user_id,
        customer_whatsapp: client?.whatsapp || activeTab.customer_whatsapp,
      })
      .eq('id', activeTab.id);
    setSavingName(false);
    if (updateError) {
      console.error(updateError);
      setError('Não foi possível salvar o nome.');
      return;
    }
    if (client) setNameDraft(client.name);
    await load();
  };

  const visibleProducts = useMemo(() => {
    if (!activeCategory) return products;
    return products.filter((p) => p.category_id === activeCategory);
  }, [products, activeCategory]);

  const openTable = async (tableNumber: number) => {
    setError('');
    setBusy(true);
    try {
      const { error: insertError } = await supabase.from('orders').insert({
        user_id: null,
        customer_name: `Mesa ${tableNumber}`,
        customer_whatsapp: '00000000000',
        fulfillment: 'dine_in',
        address: null,
        payment_method: null,
        change_for: null,
        status: 'open_tab',
        channel: 'dine_in',
        table_number: tableNumber,
        subtotal: 0,
        delivery_fee: 0,
        discount: 0,
        total: 0,
      });
      if (insertError) throw insertError;
      await load();
      setActiveTableNumber(tableNumber);
    } catch (e) {
      console.error(e);
      setError('Não foi possível abrir a mesa.');
    } finally {
      setBusy(false);
    }
  };

  const addItem = async (item: { productId: string; name: string; unitPrice: number; quantity: number; addons: { name: string; price: number }[]; notes: string }) => {
    if (!activeTab) return;
    const addonsTotal = item.addons.reduce((s, a) => s + Number(a.price), 0);
    const { error: itemError } = await supabase.from('order_items').insert({
      order_id: activeTab.id,
      product_id: item.productId,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      addons: item.addons,
      notes: item.notes || null,
      total: (Number(item.unitPrice) + addonsTotal) * item.quantity,
    });
    if (itemError) {
      console.error(itemError);
      setError('Não foi possível adicionar o item.');
      return;
    }
    setModalProduct(null);
    await load();
  };

  const removeItem = async (itemId: string) => {
    const { error: delError } = await supabase.from('order_items').delete().eq('id', itemId);
    if (delError) console.error(delError);
    await load();
  };

  const closeTab = async () => {
    if (!activeTab) return;
    setBusy(true);
    setError('');
    try {
      const { data: updated, error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          payment_method: closePayment,
          change_for: closePayment === 'cash' && closeChangeFor ? Number(closeChangeFor) : null,
          table_number: null,
          closed_at: new Date().toISOString(),
        })
        .eq('id', activeTab.id)
        .select('*, order_items(*)')
        .single();
      if (updateError) throw updateError;
      printOrder({ ...(updated as Order), table_number: activeTab.table_number } as Order);
      setClosing(false);
      setCloseChangeFor('');
      setActiveTableNumber(null);
      await load();
    } catch (e) {
      console.error(e);
      setError('Não foi possível fechar a comanda.');
    } finally {
      setBusy(false);
    }
  };

  if (activeTab) {
    const itemsTotal = (activeTab.order_items ?? []).reduce((s, i) => s + Number(i.total), 0);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold">Mesa {activeTab.table_number}</h1>
            <p className="text-sm text-neutral-500">Comanda aberta · {brl(itemsTotal)}</p>
          </div>
          <button className="text-sm font-semibold text-neutral-500 shrink-0" onClick={() => setActiveTableNumber(null)}>
            ← Voltar às mesas
          </button>
        </div>

        <div className="flex items-center gap-2 relative">
          <input
            className="input flex-1"
            placeholder="Nome do responsável (busque um cliente ou digite)"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 150);
              saveName();
            }}
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
          />
          {savingName && <span className="text-xs text-neutral-400 shrink-0">salvando...</span>}
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
              {suggestions.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex flex-col"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => saveName(c)}
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.whatsapp && <span className="text-xs text-neutral-400">{c.whatsapp}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <nav className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setActiveCategory(null)}
                className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold border ${
                  !activeCategory ? 'bg-brand text-white border-brand' : 'bg-white border-neutral-300 text-neutral-600'
                }`}
              >
                Tudo
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold border ${
                    activeCategory === c.id ? 'bg-brand text-white border-brand' : 'bg-white border-neutral-300 text-neutral-600'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </nav>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[calc(100vh-16rem)] overflow-y-auto pb-2">
              {visibleProducts.map((p) => {
                const hasPromo = p.promo_price != null && Number(p.promo_price) < Number(p.price);
                const price = hasPromo ? Number(p.promo_price) : Number(p.price);
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      if ((p.addon_groups ?? []).length > 0) setModalProduct(p);
                      else addItem({ productId: p.id, name: p.name, unitPrice: price, quantity: 1, addons: [], notes: '' });
                    }}
                    className="card p-3 text-left hover:border-brand"
                  >
                    <p className="font-semibold text-sm leading-snug">{p.name}</p>
                    <p className="text-brand font-bold text-sm mt-1">{brl(price)}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="card p-3 space-y-2">
              <h2 className="font-semibold text-sm">Itens da comanda</h2>
              {(activeTab.order_items ?? []).length === 0 && <p className="text-sm text-neutral-400">Nenhum item ainda.</p>}
              {(activeTab.order_items ?? []).map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-2 text-sm border-b border-neutral-100 pb-2 last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{item.quantity}x {item.product_name}</p>
                    {item.addons?.length > 0 && <p className="text-xs text-neutral-500 truncate">{item.addons.map((a) => a.name).join(', ')}</p>}
                    {item.notes && <p className="text-xs text-neutral-400 italic truncate">{item.notes}</p>}
                    <p className="text-xs text-neutral-500 mt-0.5">{brl(Number(item.total))}</p>
                  </div>
                  <button className="text-red-400 text-xs shrink-0" onClick={() => removeItem(item.id)}>
                    remover
                  </button>
                </div>
              ))}
              <div className="flex justify-between font-bold text-base pt-1 border-t border-neutral-100 mt-1">
                <span>Total</span>
                <span>{brl(itemsTotal)}</span>
              </div>
            </div>

            {!closing ? (
              <button
                className="btn-brand w-full text-base"
                disabled={(activeTab.order_items ?? []).length === 0}
                onClick={() => setClosing(true)}
              >
                Fechar comanda · {brl(itemsTotal)}
              </button>
            ) : (
              <div className="card p-3 space-y-2">
                <h2 className="font-semibold text-sm">Forma de pagamento</h2>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['pix', 'card', 'cash'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setClosePayment(p)}
                      className={`rounded-lg border px-2 py-2 text-xs font-medium ${closePayment === p ? 'border-brand bg-brand/5 text-brand' : 'border-neutral-300'}`}
                    >
                      {p === 'pix' ? 'PIX' : p === 'card' ? 'Cartão' : 'Dinheiro'}
                    </button>
                  ))}
                </div>
                {closePayment === 'cash' && (
                  <input
                    className="input"
                    type="number"
                    placeholder="Troco para quanto? (opcional)"
                    value={closeChangeFor}
                    onChange={(e) => setCloseChangeFor(e.target.value)}
                  />
                )}
                <div className="flex gap-2 pt-1">
                  <button className="flex-1 border border-neutral-300 rounded-lg py-2 text-sm font-semibold" onClick={() => setClosing(false)}>
                    Cancelar
                  </button>
                  <button className="flex-1 btn-brand text-sm" onClick={closeTab} disabled={busy}>
                    {busy ? 'Fechando...' : 'Confirmar e imprimir'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {modalProduct && (
          <ProductPickerModal
            product={modalProduct}
            onClose={() => setModalProduct(null)}
            onAdd={(item) => addItem(item)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Mesas / Comandas</h1>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {Array.from({ length: TABLE_COUNT }, (_, i) => i + 1).map((n) => {
          const tab = tabs.find((t) => t.table_number === n);
          const itemsTotal = tab ? (tab.order_items ?? []).reduce((s, i) => s + Number(i.total), 0) : 0;
          return (
            <button
              key={n}
              disabled={busy}
              onClick={() => (tab ? setActiveTableNumber(n) : openTable(n))}
              className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 font-semibold transition ${
                tab ? 'bg-brand text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
              }`}
            >
              <span className="text-2xl font-bold">{String(n).padStart(2, '0')}</span>
              {tab && !tab.customer_name.startsWith('Mesa ') && (
                <span className="text-[10px] px-1 truncate max-w-full">{tab.customer_name}</span>
              )}
              <span className="text-[11px] uppercase tracking-wide">{tab ? brl(itemsTotal) : 'Livre'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
