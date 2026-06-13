'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignOutButton() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  return (
    <button
      className="w-full border border-neutral-300 rounded-lg px-4 py-3 font-semibold bg-white text-neutral-600 hover:text-red-500"
      onClick={async () => {
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
      }}
    >
      Sair da conta
    </button>
  );
}
