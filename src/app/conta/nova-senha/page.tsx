'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function NewPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('A senha deve ter pelo menos 6 caracteres.');
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    router.push('/conta');
  };

  return (
    <div className="py-10 max-w-sm mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-center">Definir nova senha</h1>
      <form className="card p-5 space-y-3" onSubmit={submit}>
        <input
          className="input"
          type="password"
          placeholder="Nova senha"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" className="btn-brand w-full" disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar senha'}
        </button>
      </form>
    </div>
  );
}
