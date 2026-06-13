import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProductDetail from '@/components/ProductDetail';
import type { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: product } = await supabase
    .from('products')
    .select('*, addon_groups(*, addons(*))')
    .eq('id', params.id)
    .eq('active', true)
    .single();

  if (!product) notFound();

  return <ProductDetail product={product as Product} />;
}
