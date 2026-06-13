import { createClient } from '@/lib/supabase/server';
import MenuBrowser from '@/components/MenuBrowser';
import type { Category, Product, StoreSettings } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = createClient();

  const [{ data: categories }, { data: products }, { data: settings }] = await Promise.all([
    supabase.from('categories').select('*').eq('active', true).order('sort_order'),
    supabase
      .from('products')
      .select('*, addon_groups(*, addons(*))')
      .eq('active', true)
      .order('sort_order'),
    supabase.from('store_settings').select('*').single(),
  ]);

  return (
    <MenuBrowser
      categories={(categories ?? []) as Category[]}
      products={(products ?? []) as Product[]}
      settings={(settings ?? null) as StoreSettings | null}
    />
  );
}
