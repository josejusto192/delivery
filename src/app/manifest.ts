import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let name = 'Delivery';
  let themeColor = '#ea1d2c';
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from('store_settings')
      .select('name, brand_color')
      .single();
    if (data?.name) name = data.name;
    if (data?.brand_color) themeColor = data.brand_color;
  } catch {}

  return {
    name,
    short_name: name,
    description: 'Peça online direto da loja.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fafafa',
    theme_color: themeColor,
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
