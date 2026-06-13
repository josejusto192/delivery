'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/lib/cart';
import { brl } from '@/lib/format';
import { maskPhone, isValidPhone } from '@/lib/phone';
import { isStoreOpenNow } from '@/lib/storeHours';
import type { Address, Coupon, StoreSettings } from '@/lib/types';

export default function CheckoutPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { items, subtotal, clear } = useCart();

  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);

  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [fulfillment, setFulfillment] = useState<'delivery' | 'pickup'>('delivery');
  const [address, setAddress] = useState({
    street: '', number: '', complement: '', neighborhood: '', city: '', reference: '',
  });
  const [areaName, setAreaName] = useState('');
  const [payment, setPayment] = useState<'pix' | 'card' | 'cash'>('pix');
  const [changeFor, setChangeFor] = useState('');
  const [notes, setNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const loadAccount = async (id: string) => {
    setUserId(id);
    const { data: profile } = await supabase
      .from('profiles').select('name, whatsapp').eq('id', id).single();
    if (profile) {
      if (profile.name) setName(profile.name);
      if (profile.whatsapp) setWhatsapp(maskPhone(profile.whatsapp));
    }
    const { data: addrs } = await supabase.from('addresses').select('*').eq('user_id', id);
    setSavedAddresses(addrs ?? []);
  };

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from('store_settings').select('*').single();
      setSettings(s);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await loadAccount(user.id);
    })();
  }, [supabase]);

  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthMessage('');
    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw new Error('E-mail ou senha incorretos.');
        if (data.user) await loadAccount(data.user.id);
        setAuthMode(null);
      } else {
        if (!name.trim()) throw new Error('Informe seu nome.');
        if (whatsapp && !isValidPhone(whatsapp)) throw new Error('WhatsApp inválido. Use o formato (11) 99999-9999.');
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: { data: { name: name.trim(), whatsapp: whatsapp.trim() } },
        });
        if (error) throw new Error(error.message);
        if (data.user && data.session) {
          await loadAccount(data.user.id);
          setAuthMode(null);
        } else {
          setAuthMessage('Conta criada! Verifique seu e-mail para confirmar e depois entre.');
          setAuthMode('login');
        }
      }
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setAuthLoading(false);
    }
  };

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
    const { data } = await supabase
      .from('coupons').select('*').eq('code', code).eq('active', true).maybeSingle();
    if (!data) return setCouponError('Cupom inválido.');
    if (data.expires_at && new Date(data.expires_at) < new Date())
      return setCouponError('Cupom expirado.');
    if (data.max_uses && data.used_count >= data.max_uses)
      return setCouponError('Cupom esgotado.');
    if (subtotal < Number(data.min_order))
      return setCouponError(`Pedido mínimo de ${brl(Number(data.min_order))} para este cupom.`);
    setCoupon(data);
  };

  const fillSavedAddress = (a: Address) => {
    setAddress({
      street: a.street, number: a.number, complement: a.complement ?? '',
      neighborhood: a.neighborhood, city: a.city, reference: a.reference ?? '',
    });
  };

  const submit = async () => {
    setError('');
    if (items.length === 0) return setError('Carrinho vazio.');
    if (!name.trim() || !whatsapp.trim()) return setError('Informe nome e WhatsApp.');
    if (!isValidPhone(whatsapp)) return setError('WhatsApp inválido. Use o formato (11) 99999-9999.');
    if (!isStoreOpenNow(settings)) return setError('A loja está fechada no momento.');
    if (fulfillment === 'delivery' && (!address.street || !address.number || !address.neighborhood))
      return setError('Preencha o endereço de entrega.');
    if (settings && subtotal < Number(settings.min_order))
      return setError(`Pedido mínimo: ${brl(Number(settings.min_order))}.`);

    setSubmitting(true);
    try {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          customer_name: name.trim(),
          customer_whatsapp: whatsapp.trim(),
          fulfillment,
          address: fulfillment === 'delivery' ? { ...address, area: areaName } : null,
          payment_method: payment,
          change_for: payment === 'cash' && changeFor ? Number(changeFor) : null,
          subtotal,
          delivery_fee: deliveryFee,
          discount,
          total,
          coupon_code: coupon?.code ?? null,
          notes: notes.trim() || null,
        })
        .select('id')
        .single();
      if (orderError) throw orderError;

      const { error: itemsError } = await supabase.from('order_items').insert(
        items.map((i) => {
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
        })
      );
      if (itemsError) throw itemsError;

      clear();
      router.push(`/pedido/${order.id}`);
    } catch (e) {
      console.error(e);
      setError('Não foi possível enviar o pedido. Tente novamente.');
      setSubmitting(false);
    }
  };

  if (items.length === 0 && !submitting) {
    return <p className="py-20 text-center text-neutral-500">Seu carrinho está vazio.</p>;
  }

  const areas = settings?.delivery_areas ?? [];

  return (
    <div className="py-6 max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Finalizar pedido</h1>

      {!userId && (
        <section className="card p-4 space-y-3">
          {authMode === null ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-neutral-500">Já tem conta? Entre para acompanhar seus pedidos.</p>
              <div className="flex gap-2 shrink-0">
                <button type="button" className="text-sm font-semibold text-brand" onClick={() => setAuthMode('login')}>
                  Entrar
                </button>
                <button type="button" className="text-sm font-semibold text-brand" onClick={() => setAuthMode('signup')}>
                  Cadastrar
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submitAuth} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{authMode === 'login' ? 'Entrar' : 'Criar conta'}</h2>
                <button type="button" className="text-xs text-neutral-500" onClick={() => setAuthMode(null)}>
                  continuar sem login
                </button>
              </div>
              {authMode === 'signup' && (
                <p className="text-xs text-neutral-500">
                  Usaremos o nome e WhatsApp informados acima para sua conta.
                </p>
              )}
              <input
                className="input"
                type="email"
                placeholder="E-mail"
                autoComplete="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
              />
              <input
                className="input"
                type="password"
                placeholder="Senha"
                autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={6}
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
              />
              {authError && <p className="text-sm text-red-500">{authError}</p>}
              {authMessage && <p className="text-sm text-green-600">{authMessage}</p>}
              <button type="submit" className="btn-brand w-full" disabled={authLoading}>
                {authLoading ? 'Aguarde...' : authMode === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
              <button
                type="button"
                className="text-sm text-brand font-semibold block mx-auto"
                onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              >
                {authMode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tenho conta — entrar'}
              </button>
            </form>
          )}
        </section>
      )}

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Seus dados</h2>
        <input className="input" placeholder="Nome" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          className="input"
          type="tel"
          inputMode="tel"
          placeholder="WhatsApp — (11) 99999-9999"
          autoComplete="tel-national"
          value={whatsapp}
          onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
        />
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Entrega ou retirada</h2>
        <div className="grid grid-cols-2 gap-2">
          {(['delivery', 'pickup'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFulfillment(f)}
              className={`rounded-lg border px-4 py-3 font-medium text-sm ${
                fulfillment === f ? 'border-brand bg-brand/5 text-brand' : 'border-neutral-300'
              }`}
            >
              {f === 'delivery' ? 'Entrega' : 'Retirada'}
            </button>
          ))}
        </div>

        {fulfillment === 'delivery' && (
          <div className="space-y-3 pt-1">
            {savedAddresses.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {savedAddresses.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => fillSavedAddress(a)}
                    className="text-xs border border-neutral-300 rounded-full px-3 py-1.5 bg-white hover:border-brand"
                  >
                    {a.label}: {a.street}, {a.number}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <input className="input col-span-2" placeholder="Rua" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} />
              <input className="input" placeholder="Número" value={address.number} onChange={(e) => setAddress({ ...address, number: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Bairro" value={address.neighborhood} onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })} />
              <input className="input" placeholder="Cidade" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Complemento (opcional)" value={address.complement} onChange={(e) => setAddress({ ...address, complement: e.target.value })} />
              <input className="input" placeholder="Referência (opcional)" value={address.reference} onChange={(e) => setAddress({ ...address, reference: e.target.value })} />
            </div>
            {areas.length > 0 && (
              <select className="input" value={areaName} onChange={(e) => setAreaName(e.target.value)}>
                <option value="">Selecione sua região de entrega</option>
                {areas.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name} — taxa {brl(Number(a.fee))}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {fulfillment === 'pickup' && settings?.address && (
          <p className="text-sm text-neutral-500">Retirar em: {settings.address}</p>
        )}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Pagamento</h2>
        <div className="grid grid-cols-3 gap-2">
          {(['pix', 'card', 'cash'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPayment(p)}
              className={`rounded-lg border px-3 py-3 font-medium text-sm ${
                payment === p ? 'border-brand bg-brand/5 text-brand' : 'border-neutral-300'
              }`}
            >
              {p === 'pix' ? 'PIX' : p === 'card' ? 'Cartão' : 'Dinheiro'}
            </button>
          ))}
        </div>
        {payment === 'cash' && (
          <input
            className="input"
            type="number"
            placeholder="Troco para quanto? (opcional)"
            value={changeFor}
            onChange={(e) => setChangeFor(e.target.value)}
          />
        )}
        <p className="text-xs text-neutral-400">O pagamento é realizado na entrega/retirada ou combinado pelo WhatsApp.</p>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Cupom</h2>
        <div className="flex gap-2">
          <input className="input flex-1 uppercase" placeholder="Código do cupom" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
          <button onClick={applyCoupon} className="border border-neutral-300 rounded-lg px-4 font-semibold text-sm bg-white">
            Aplicar
          </button>
        </div>
        {coupon && <p className="text-sm text-green-600">Cupom {coupon.code} aplicado ✓</p>}
        {couponError && <p className="text-sm text-red-500">{couponError}</p>}
      </section>

      <section className="card p-4 space-y-2">
        <textarea className="input" rows={2} placeholder="Observações do pedido (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="text-sm space-y-1 pt-2">
          <Row label="Subtotal" value={brl(subtotal)} />
          <Row label="Taxa de entrega" value={deliveryFee === 0 ? 'Grátis' : brl(deliveryFee)} />
          {discount > 0 && <Row label="Desconto" value={`− ${brl(discount)}`} className="text-green-600" />}
          <div className="flex justify-between font-bold text-base pt-1 border-t border-neutral-100 mt-2">
            <span>Total</span>
            <span>{brl(total)}</span>
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
      {settings && !isStoreOpenNow(settings) && (
        <p className="text-sm text-red-500 text-center font-medium">A loja está fechada no momento.</p>
      )}

      <button
        className="btn-brand w-full text-base"
        onClick={submit}
        disabled={submitting || (settings ? !isStoreOpenNow(settings) : false)}
      >
        {submitting ? 'Enviando...' : `Enviar pedido · ${brl(total)}`}
      </button>
    </div>
  );
}

function Row({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex justify-between ${className}`}>
      <span className="text-neutral-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}
