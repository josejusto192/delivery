import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SignOutButton from '@/components/SignOutButton';

export default async function AccountPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/conta/entrar');

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, whatsapp, role')
    .eq('id', user.id)
    .single();

  return (
    <div className="py-8 max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Minha conta</h1>
      <div className="card p-5">
        <p className="font-semibold">{profile?.name || 'Cliente'}</p>
        <p className="text-sm text-neutral-500">{user.email}</p>
        {profile?.whatsapp && <p className="text-sm text-neutral-500">{profile.whatsapp}</p>}
      </div>

      <nav className="card divide-y divide-neutral-100">
        <Link href="/conta/pedidos" className="block px-5 py-4 font-medium hover:bg-neutral-50">
          Meus pedidos →
        </Link>
        <Link href="/conta/enderecos" className="block px-5 py-4 font-medium hover:bg-neutral-50">
          Meus endereços →
        </Link>
        {profile?.role === 'admin' && (
          <Link href="/admin" className="block px-5 py-4 font-medium text-brand hover:bg-neutral-50">
            Painel da loja →
          </Link>
        )}
      </nav>

      <SignOutButton />
    </div>
  );
}
