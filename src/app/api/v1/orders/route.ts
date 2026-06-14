import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireApiKey } from '@/lib/apiAuth';
import { maskPhone } from '@/lib/phone';
import { serializeOrder } from '@/lib/api/orders';

export const dynamic = 'force-dynamic';

type ItemInput = {
  product_id: string;
  quantity?: number;
  addons?: string[]; // nomes dos adicionais
  notes?: string;
};

const CHANNELS = ['web', 'counter', 'phone', 'whatsapp'] as const;
const PAYMENTS = ['pix', 'card', 'cash'] as const;
const FULFILLMENTS = ['delivery', 'pickup'] as const;

export async function POST(req: NextRequest) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  let body: {
    customer_name?: string;
    customer_whatsapp?: string;
    fulfillment?: string;
    address?: Record<string, string>;
    payment_method?: string;
    change_for?: number;
    channel?: string;
    notes?: string;
    coupon_code?: string;
    items?: ItemInput[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  if (!body.customer_name?.trim()) return NextResponse.json({ error: 'customer_name é obrigatório.' }, { status: 400 });
  if (!body.customer_whatsapp?.trim()) return NextResponse.json({ error: 'customer_whatsapp é obrigatório.' }, { status: 400 });
  if (!FULFILLMENTS.includes(body.fulfillment as 'delivery' | 'pickup'))
    return NextResponse.json({ error: `fulfillment deve ser um de: ${FULFILLMENTS.join(', ')}` }, { status: 400 });
  if (!PAYMENTS.includes(body.payment_method as 'pix' | 'card' | 'cash'))
    return NextResponse.json({ error: `payment_method deve ser um de: ${PAYMENTS.join(', ')}` }, { status: 400 });
  if (body.fulfillment === 'delivery' && (!body.address?.street || !body.address?.number || !body.address?.neighborhood))
    return NextResponse.json({ error: 'address (street, number, neighborhood) é obrigatório para entrega.' }, { status: 400 });
  if (!Array.isArray(body.items) || body.items.length === 0)
    return NextResponse.json({ error: 'items deve ter ao menos 1 item.' }, { status: 400 });

  const channel = body.channel && (CHANNELS as readonly string[]).includes(body.channel) ? body.channel : 'whatsapp';

  const supabase = createAdminClient();

  // valida e monta itens a partir do catálogo (preços vêm do banco, não do payload)
  const orderItems: {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    addons: { name: string; price: number }[];
    notes: string | null;
    total: number;
  }[] = [];

  for (const item of body.items) {
    if (!item.product_id) return NextResponse.json({ error: 'Cada item precisa de product_id.' }, { status: 400 });
    const quantity = Math.max(1, Math.floor(Number(item.quantity ?? 1)));

    const { data: product, error: prodError } = await supabase
      .from('products')
      .select('id, name, price, promo_price, active, addon_groups(id, addons(name, price, active))')
      .eq('id', item.product_id)
      .single();

    if (prodError || !product || !product.active)
      return NextResponse.json({ error: `Produto ${item.product_id} não encontrado ou inativo.` }, { status: 400 });

    const unitPrice =
      product.promo_price != null && Number(product.promo_price) < Number(product.price)
        ? Number(product.promo_price)
        : Number(product.price);

    const availableAddons = (product.addon_groups ?? []).flatMap((g) => g.addons ?? []);
    const addons: { name: string; price: number }[] = [];
    for (const name of item.addons ?? []) {
      const found = availableAddons.find((a) => a.name === name && a.active);
      if (!found) return NextResponse.json({ error: `Adicional "${name}" inválido para o produto ${product.name}.` }, { status: 400 });
      addons.push({ name: found.name, price: Number(found.price) });
    }

    const addonsTotal = addons.reduce((s, a) => s + a.price, 0);
    orderItems.push({
      product_id: product.id,
      product_name: product.name,
      quantity,
      unit_price: unitPrice,
      addons,
      notes: item.notes?.trim() || null,
      total: (unitPrice + addonsTotal) * quantity,
    });
  }

  const subtotal = orderItems.reduce((s, i) => s + i.total, 0);

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: null,
      customer_name: body.customer_name.trim(),
      customer_whatsapp: maskPhone(body.customer_whatsapp).trim() || body.customer_whatsapp.trim(),
      fulfillment: body.fulfillment,
      address: body.fulfillment === 'delivery' ? body.address : null,
      payment_method: body.payment_method,
      change_for: body.payment_method === 'cash' && body.change_for ? Number(body.change_for) : null,
      status: 'new',
      channel,
      subtotal,
      delivery_fee: 0,
      discount: 0,
      total: subtotal,
      coupon_code: body.coupon_code?.trim().toUpperCase() || null,
      notes: body.notes?.trim() || null,
    })
    .select('*')
    .single();

  if (orderError || !order) {
    console.error(orderError);
    return NextResponse.json({ error: 'Não foi possível criar o pedido.' }, { status: 500 });
  }

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems.map((i) => ({ ...i, order_id: order.id })));

  if (itemsError) {
    console.error(itemsError);
    await supabase.from('orders').delete().eq('id', order.id);
    return NextResponse.json({ error: 'Não foi possível salvar os itens do pedido.' }, { status: 500 });
  }

  // busca o pedido com os totais já recalculados pelo trigger + itens
  const { data: finalOrder } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', order.id)
    .single();

  return NextResponse.json(serializeOrder(finalOrder ?? order), { status: 201 });
}

export async function GET(req: NextRequest) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const whatsapp = searchParams.get('customer_whatsapp');
  const status = searchParams.get('status');
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)));

  let query = supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(limit);
  if (whatsapp) query = query.eq('customer_whatsapp', maskPhone(whatsapp));
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Erro ao buscar pedidos.' }, { status: 500 });

  return NextResponse.json((data ?? []).map(serializeOrder));
}
