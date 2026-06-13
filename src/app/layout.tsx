import type { Metadata } from 'next';
import './globals.css';
import { CartProvider } from '@/lib/cart';
import { createClient } from '@/lib/supabase/server';
import SiteShell from '@/components/SiteShell';

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const supabase = createClient();
  const { data } = await supabase.from('store_settings').select('name').single();
  return {
    title: data?.name ?? 'Delivery',
    description: 'Peça online direto da loja, sem taxas de marketplace.',
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: settings } = await supabase.from('store_settings').select('*').single();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const brandRgb = settings?.brand_color ? hexToRgb(settings.brand_color) : '234 29 44';

  return (
    <html lang="pt-BR">
      <body>
        <style>{`:root { --brand: ${brandRgb}; --brand-dark: ${brandRgb}; }`}</style>
        <CartProvider>
          <SiteShell settings={settings} loggedIn={!!user}>
            {children}
          </SiteShell>
        </CartProvider>
      </body>
    </html>
  );
}
