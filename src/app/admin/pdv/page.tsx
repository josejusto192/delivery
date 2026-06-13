'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { brl } from '@/lib/format';
import { printOrder } from '@/lib/print';
import type { AddonGroup, Category, Coupon, Product, StoreSettings } from '@/lib/types';

type CartAddon = { name: string; price: number };
type CartItem = {
  key: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  addons: CartAddon[];
  notes: string;
};

const CHANNEL_OPTIONS = [
  { value: 'counter', label: 'Balcão' },
  { value: 'phone', label: 'Telefone' },
  { value: 'whatsapp', label: 'WhatsApp' },
] as const;

export default function PdvPage() {
  const supabase = useMemo(() => createClient(), []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalProduct, setModalProduct] = useState<Product | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('Cliente balcão');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [channel, setChannel] = useState<'counter' | 'phone' | 'whatsapp'>('counter');
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('pickup');
  const [address, setAddress] = useState({ street: '', number: '', complement: '', neighborhood: '', city: '', reference: '' });
  const [areaName, setAreaName] = useState('');
  const [payment, setPayment] = useState<'pix' | 'card' | 'cash'>('cash');
  const [changeFor, setChangeFor] = useState('');
  const [notes, setNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    (async () => {
      const [{ data: cats }, { data: prods }, { data: s }] = await Promise.all([
        supabase.from('categories').select('*').eq('active', true).order('sort_order'),
        supabase.from('products').select('*, addon_groups(*, addons(*))').eq('active', true).order('sort_order'),
        supabase.from('store_settings').select('*').single(),
      ]);
      setCategories(cats ?? []);
      setProducts((prods ?? []) as Product[]);
      setSettings(s);
      setLoading(false);
    })();
  }, [supabase]);

  const visibleProducts = useMemo(() => {
    let list = products;
    if (activeCategory) list = list.filter((p) => p.category_id === activeCategory);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, activeCategory, search]);

  const addToCart = (item: Omit<CartItem, 'key'>) => {
    setCart((prev) => [...prev, { ...item, key: `${item.productId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }]);
  };

  const updateQty = (key: string, qty: number) => {
    setCart((prev) => (qty <= 0 ? prev.filter((i) => i.key !== key) : prev.map((i) => (i.key === key ? { ...i, quantity: qty } : i))));
  };

  const removeItem = (key: string) => setCart((prev) => prev.filter((i) => i.key !== key));

  const subtotal = useMemo(
    () => cart.reduce((sum, i) => sum + (Number(i.unitPrice) + i.addons.reduce((a, ad) => a + Number(ad.price), 0)) * i.quantity, 0),
    [cart]
  );

  const deliveryFee = useMemo(() => {
    if (fulfillment === 'pickup') return 0;
    if (coupon?.type === 'free_delivery') return 0;
    const areas = settings?.delivery_areas ?? [];
    if (areas.length > 0 && areaName) {
      const area = areas.find((a) => a.name === areaName);
      return Number(area?.fee ?? settings?.delivery_fee ?? 0);
    }
    return Number(settings?.delivery_fee ?? 0);
  }, [fulfillment, settings, areaName, coupon]);

  const discount = useMemo(() => {
    if (!coupon) return 0;
    if (coupon.type === 'percent') return (subtotal * Number(coupon.value)) / 100;
    if (coupon.type === 'fixed') return Math.min(Number(coupon.value), subtotal);
    return 0;
  }, [coupon, subtotal]);

  const total = Math.max(0, subtotal + deliveryFee - discount);

  const applyCoupon = async () => {
    setCouponError('');
    setCoupon(null);
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    const { data } = await supabase.from('coupons').select('*').eq('code', code).eq('active', true).maybeSingle();
    if (!data) return setCouponError('Cupom inválido.');
    if (data.expires_at && new Date(data.expires_at) < new Date()) return setCouponError('Cupom expirado.');
    if (data.max_uses && data.used_count >= data.max_uses) return setCouponError('Cupom esgotado.');
    if (subtotal < Number(data.min_order)) return setCouponError(`Pedido mínimo de ${brl(Number(data.min_order))} para este cupom.`);
    setCoupon(data);
  };

  const resetOrder = () => {
    setCart([]);
    setCustomerName('Cliente balcão');
    setCustomerWhatsapp('');
    setFulfillment('pickup');
    setAddress({ street: '', number: '', complement: '', neighborhood: '', city: '', reference: '' });
    setAreaName('');
    setPayment('cash');
    setChangeFor('');
    setNotes('');
    setCouponCode('');
    setCoupon(null);
    setCouponError('');
  };

  const submit = async () => {
    setError('');
    setSuccess('');
    if (cart.length === 0) return setError('Adicione itens ao pedido.');
    if (fulfillment === 'delivery' && (!address.street || !address.number || !address.neighborhood))
      return setError('Preencha o endereço de entrega.');

    setSubmitting(true);
    try {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: null,
          customer_name: customerName.trim() || 'Cliente balcão',
          customer_whatsapp: customerWhatsapp.trim() || '00000000000',
          fulfillment,
          address: fulfillment === 'delivery' ? { ...address, area: areaName } : null,
          payment_method: payment,
          change_for: payment === 'cash' && changeFor ? Number(changeFor) : null,
          status: 'confirmed',
          channel,
          subtotal,
          delivery_fee: deliveryFee,
          discount,
          total,
          coupon_code: coupon?.code ?? null,
          notes: notes.trim() || null,
        })
        .select('*')
        .single();
      if (orderError) throw orderError;

      const orderItems = cart.map((i) => {
        const addonsTotal = i.addons.reduce((s, a) => s + Number(a.price), 0);
        return {
          order_id: order.id,
          product_id: i.productId,
          product_name: i.name,
          quantity: i.quantity,
          unit_price: i.unitPrice,
          addons: i.addons,
          notes: i.notes || null,
          total: (Number(i.unitPrice) + addonsTotal) * i.quantity,
        };
      });
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      printOrder({ ...order, order_items: orderItems } as never);
      setSuccess(`Pedido #${order.code} criado com sucesso!`);
      resetOrder();
    } catch (e) {
      console.error(e);
      setError('Não foi possível criar o pedido. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-neutral-500 py-8 text-center">Carregando...</p>;

  const areas = settings?.delivery_areas ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">PDV — Novo pedido</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* produtos */}
        <div className="lg:col-span-2 space-y-3">
          <input className="input" placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[calc(100vh-14rem)] overflow-y-auto pb-2">
            {visibleProducts.map((p) => {
              const hasPromo = p.promo_price != null && Number(p.promo_price) < Number(p.price);
              const price = hasPromo ? Number(p.promo_price) : Number(p.price);
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    if ((p.addon_groups ?? []).length > 0) setModalProduct(p);
                    else
                      addToCart({
                        productId: p.id,
                        name: p.name,
                        unitPrice: price,
                        quantity: 1,
                        addons: [],
                        notes: '',
                      });
                  }}
                  className="card p-3 text-left hover:border-brand"
                >
                  <p className="font-semibold text-sm leading-snug">{p.name}</p>
                  <p className="text-brand font-bold text-sm mt-1">{brl(price)}</p>
                </button>
              );
            })}
            {visibleProducts.length === 0 && <p className="col-span-full text-center text-neutral-400 py-8 text-sm">Nenhum produto.</p>}
          </div>
        </div>

        {/* carrinho / dados do pedido */}
        <div className="space-y-3">
          <div className="card p-3 space-y-2">
            <h2 className="font-semibold text-sm">Itens</h2>
            {cart.length === 0 && <p className="text-sm text-neutral-400">Nenhum item adicionado.</p>}
            {cart.map((item) => {
              const addonsTotal = item.addons.reduce((s, a) => s + Number(a.price), 0);
              return (
                <div key={item.key} className="flex items-start justify-between gap-2 text-sm border-b border-neutral-100 pb-2 last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{item.name}</p>
                    {item.addons.length > 0 && (
                      <p className="text-xs text-neutral-500 truncate">{item.addons.map((a) => a.name).join(', ')}</p>
                    )}
                    {item.notes && <p className="text-xs text-neutral-400 italic truncate">{item.notes}</p>}
                    <p className="text-xs text-neutral-500 mt-0.5">{brl((Number(item.unitPrice) + addonsTotal) * item.quantity)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button className="h-6 w-6 rounded border border-neutral-300 font-bold text-xs" onClick={() => updateQty(item.key, item.quantity - 1)}>
                      −
                    </button>
                    <span className="w-5 text-center text-sm">{item.quantity}</span>
                    <button className="h-6 w-6 rounded border border-neutral-300 font-bold text-xs" onClick={() => updateQty(item.key, item.quantity + 1)}>
                      +
                    </button>
                    <button className="text-red-400 text-xs ml-1" onClick={() => removeItem(item.key)}>
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card p-3 space-y-2">
            <h2 className="font-semibold text-sm">Cliente</h2>
            <input className="input" placeholder="Nome" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <input className="input" placeholder="WhatsApp (opcional)" value={customerWhatsapp} onChange={(e) => setCustomerWhatsapp(e.target.value)} />
            <div className="grid grid-cols-3 gap-1.5">
              {CHANNEL_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setChannel(c.value)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium ${channel === c.value ? 'border-brand bg-brand/5 text-brand' : 'border-neutral-300'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-3 space-y-2">
            <h2 className="font-semibold text-sm">Entrega ou retirada</h2>
            <div className="grid grid-cols-2 gap-1.5">
              {(['pickup', 'delivery'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFulfillment(f)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium ${fulfillment === f ? 'border-brand bg-brand/5 text-brand' : 'border-neutral-300'}`}
                >
                  {f === 'pickup' ? 'Retirada' : 'Entrega'}
                </button>
              ))}
            </div>
            {fulfillment === 'delivery' && (
              <div className="space-y-1.5 pt-1">
                <div className="grid grid-cols-3 gap-1.5">
                  <input className="input col-span-2" placeholder="Rua" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} />
                  <input className="input" placeholder="Nº" value={address.number} onChange={(e) => setAddress({ ...address, number: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <input className="input" placeholder="Bairro" value={address.neighborhood} onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })} />
                  <input className="input" placeholder="Cidade" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                </div>
                <input className="input" placeholder="Complemento / referência" value={address.complement} onChange={(e) => setAddress({ ...address, complement: e.target.value })} />
                {areas.length > 0 && (
                  <select className="input" value={areaName} onChange={(e) => setAreaName(e.target.value)}>
                    <option value="">Região de entrega</option>
                    {areas.map((a) => (
                      <option key={a.name} value={a.name}>
                        {a.name} — {brl(Number(a.fee))}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          <div className="card p-3 space-y-2">
            <h2 className="font-semibold text-sm">Pagamento</h2>
            <div className="grid grid-cols-3 gap-1.5">
              {(['pix', 'card', 'cash'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPayment(p)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium ${payment === p ? 'border-brand bg-brand/5 text-brand' : 'border-neutral-300'}`}
                >
                  {p === 'pix' ? 'PIX' : p === 'card' ? 'Cartão' : 'Dinheiro'}
                </button>
              ))}
            </div>
            {payment === 'cash' && (
              <input className="input" type="number" placeholder="Troco para quanto? (opcional)" value={changeFor} onChange={(e) => setChangeFor(e.target.value)} />
            )}
          </div>

          <div className="card p-3 space-y-2">
            <div className="flex gap-1.5">
              <input className="input flex-1 uppercase" placeholder="Cupom" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
              <button onClick={applyCoupon} className="border border-neutral-300 rounded-lg px-3 text-xs font-semibold bg-white">
                Aplicar
              </button>
            </div>
            {coupon && <p className="text-xs text-green-600">Cupom {coupon.code} aplicado ✓</p>}
            {couponError && <p className="text-xs text-red-500">{couponError}</p>}
            <textarea className="input" rows={2} placeholder="Observações" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="card p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><span>{brl(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">Entrega</span><span>{deliveryFee === 0 ? 'Grátis' : brl(deliveryFee)}</span></div>
            {discount > 0 && <div className="flex justify-between text-green-600"><span>Desconto</span><span>− {brl(discount)}</span></div>}
            <div className="flex justify-between font-bold text-base pt-1 border-t border-neutral-100 mt-1">
              <span>Total</span>
              <span>{brl(total)}</span>
            </div>
          </div>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          {success && <p className="text-sm text-green-600 text-center">{success}</p>}

          <button className="btn-brand w-full text-base" onClick={submit} disabled={submitting}>
            {submitting ? 'Enviando...' : `Finalizar pedido · ${brl(total)}`}
          </button>
        </div>
      </div>

      {modalProduct && (
        <ProductModal
          product={modalProduct}
          onClose={() => setModalProduct(null)}
          onAdd={(item) => {
            addToCart(item);
            setModalProduct(null);
          }}
        />
      )}
    </div>
  );
}

function ProductModal({
  product,
  onClose,
  onAdd,
}: {
  product: Product;
  onClose: () => void;
  onAdd: (item: Omit<CartItem, 'key'>) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<Record<string, CartAddon[]>>({});
  const [showErrors, setShowErrors] = useState(false);

  const groups = (product.addon_groups ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const hasPromo = product.promo_price != null && Number(product.promo_price) < Number(product.price);
  const effectivePrice = hasPromo ? Number(product.promo_price) : Number(product.price);

  const toggleAddon = (group: AddonGroup, addon: CartAddon) => {
    setSelectedAddons((prev) => {
      const current = prev[group.id] ?? [];
      const exists = current.some((a) => a.name === addon.name);
      if (group.max_select === 1) {
        if (exists) return group.min_select === 0 ? { ...prev, [group.id]: [] } : prev;
        return { ...prev, [group.id]: [addon] };
      }
      if (exists) return { ...prev, [group.id]: current.filter((a) => a.name !== addon.name) };
      if (current.length >= group.max_select) return prev;
      return { ...prev, [group.id]: [...current, addon] };
    });
  };

  const allAddons = useMemo(() => Object.values(selectedAddons).flat(), [selectedAddons]);
  const addonsTotal = allAddons.reduce((s, a) => s + Number(a.price), 0);
  const total = (effectivePrice + addonsTotal) * quantity;
  const groupOk = (g: AddonGroup) => (selectedAddons[g.id]?.length ?? 0) >= g.min_select;
  const minOk = groups.every(groupOk);

  const handleAdd = () => {
    if (!minOk) return setShowErrors(true);
    onAdd({ productId: product.id, name: product.name, unitPrice: effectivePrice, quantity, addons: allAddons, notes });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{product.name}</h2>
              <p className="text-brand font-bold">{brl(effectivePrice)}</p>
            </div>
            <button onClick={onClose} className="text-neutral-400 text-2xl leading-none">×</button>
          </div>

          {groups.map((g) => {
            const isRadio = g.max_select === 1;
            const selected = selectedAddons[g.id] ?? [];
            const missing = showErrors && !groupOk(g);
            return (
              <div key={g.id}>
                <div className={`px-3 py-2 rounded-lg flex items-center justify-between ${missing ? 'bg-red-50' : 'bg-neutral-100'}`}>
                  <span className="font-semibold text-sm">{g.name}</span>
                  {g.min_select > 0 && <span className="text-[10px] bg-brand text-white rounded px-1.5 py-0.5">obrigatório</span>}
                </div>
                <div className="px-1">
                  {(g.addons ?? [])
                    .filter((a) => a.active)
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((a) => {
                      const checked = selected.some((s) => s.name === a.name);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => toggleAddon(g, { name: a.name, price: Number(a.price) })}
                          className="w-full flex items-center justify-between gap-2 py-2 text-sm border-b border-neutral-100 last:border-0"
                        >
                          <span className="flex items-center gap-2">
                            <span className={`h-5 w-5 shrink-0 grid place-items-center border-2 text-xs ${isRadio ? 'rounded-full' : 'rounded-md'} ${checked ? 'bg-brand border-brand text-white' : 'border-neutral-300'}`}>
                              {checked && '✓'}
                            </span>
                            {a.name}
                          </span>
                          {Number(a.price) > 0 && <span className="text-neutral-600 text-xs font-medium">+{brl(Number(a.price))}</span>}
                        </button>
                      );
                    })}
                </div>
              </div>
            );
          })}

          <textarea className="input" rows={2} placeholder="Observações" value={notes} onChange={(e) => setNotes(e.target.value)} />

          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center border border-neutral-300 rounded-full">
              <button className="px-3 py-2 font-bold text-brand" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
              <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
              <button className="px-3 py-2 font-bold text-brand" onClick={() => setQuantity((q) => q + 1)}>+</button>
            </div>
            <button className={`flex-1 rounded-full px-4 py-2.5 font-semibold text-white ${minOk ? 'bg-brand' : 'bg-neutral-300'}`} onClick={handleAdd}>
              Adicionar · {brl(total)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
