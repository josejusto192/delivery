import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireApiKey } from '@/lib/apiAuth';
import { serializeOrder } from '@/lib/api/orders';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });

  return NextResponse.json(serializeOrder(data));
}
