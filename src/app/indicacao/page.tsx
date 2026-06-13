import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { brl } from '@/lib/format';
import ShareReferral from '@/components/ShareReferral';
import type { StoreSettings } from '@/lib/types';

export default async function ReferralPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/conta/entrar?next=/indicacao');

  const [{ data: settings }, { data: profile }, { data: rewards }] = await Promise.all([
    supabase.from('store_settings').select('*').single(),
    supabase.from('profiles').select('referral_code, welcome_coupon_code').eq('id', user.id).single(),
    supabase
      .from('referral_rewards')
      .select('coupon_code, created_at')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  const s = settings as StoreSettings | null;

  if (!s?.referral_enabled) {
    return <p className="py-20 text-center text-neutral-500">Programa de indicação indisponível no momento.</p>;
  }

  const percent = Number(s.referral_percent);
  const minOrder = Number(s.referral_min_order);

  return (
    <div className="py-8 max-w-md mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-center">{s.referral_title}</h1>
      <p className="text-center text-neutral-500 text-sm">{s.referral_description}</p>

      <ShareReferral code={profile?.referral_code ?? ''} />

      <div className="card p-5 space-y-2 text-sm">
        <p>
          <strong>1.</strong> Compartilhe seu código com amigos.
        </p>
        <p>
          <strong>2.</strong> Quem se cadastrar com seu código ganha {percent}% de desconto
          {minOrder > 0 ? ` em pedidos a partir de ${brl(minOrder)}` : ''} na primeira compra.
        </p>
        <p>
          <strong>3.</strong> Quando o pedido indicado por você for entregue, você ganha um cupom de {percent}% de
          desconto.
        </p>
      </div>

      {profile?.welcome_coupon_code && (
        <div className="card p-4 text-center">
          <p className="text-sm text-neutral-500">Seu cupom de boas-vindas</p>
          <p className="text-lg font-bold text-brand">{profile.welcome_coupon_code}</p>
        </div>
      )}

      <div className="card p-4 space-y-2">
        <h2 className="font-semibold text-sm">Cupons que você ganhou por indicar</h2>
        {rewards && rewards.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {rewards.map((r) => (
              <li key={r.coupon_code} className="flex justify-between">
                <span className="font-mono font-semibold text-brand">{r.coupon_code}</span>
                <span className="text-neutral-400">{percent}% off</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">
            Quando alguém usar seu código e o pedido for entregue, o cupom aparece aqui.
          </p>
        )}
      </div>
    </div>
  );
}
