'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { maskPhone, isValidPhone } from '@/lib/phone';

type Mode = 'login' | 'signup' | 'reset';

function AuthForm() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/conta';
  const ref = params.get('ref') ?? '';

  const [mode, setMode] = useState<Mode>(ref ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error('E-mail ou senha incorretos.');
        router.push(next);
        router.refresh();
      } else if (mode === 'signup') {
        if (!name.trim()) throw new Error('Informe seu nome.');
        if (whatsapp && !isValidPhone(whatsapp)) throw new Error('WhatsApp inválido. Use o formato (11) 99999-9999.');
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name.trim(), whatsapp: whatsapp.trim(), birth_date: birthDate, referral_code: ref } },
        });
        if (error) throw new Error(error.message);
        setMessage('Conta criada! Verifique seu e-mail para confirmar (se exigido) e faça login.');
        setMode('login');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/conta/nova-senha`,
        });
        if (error) throw new Error(error.message);
        setMessage('Se o e-mail existir, você receberá um link para redefinir a senha.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-10 max-w-sm mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-center">
        {mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Recuperar senha'}
      </h1>

      {ref && mode === 'signup' && (
        <p className="text-sm text-center text-green-600 -mt-2">
          Você foi indicado com o código <strong>{ref}</strong> — ganhe um cupom de desconto ao se cadastrar!
        </p>
      )}

      <form className="card p-5 space-y-3" onSubmit={submit}>
        {mode === 'signup' && (
          <>
            <input
              className="input"
              placeholder="Nome"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="input"
              type="tel"
              inputMode="tel"
              placeholder="WhatsApp — (11) 99999-9999"
              autoComplete="tel-national"
              value={whatsapp}
              onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
            />
            <label className="block text-xs text-neutral-500">
              Data de nascimento (opcional)
              <input
                className="input mt-1"
                type="date"
                autoComplete="bday"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </label>
          </>
        )}
        <input
          className="input"
          type="email"
          placeholder="E-mail"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {mode !== 'reset' && (
          <input
            className="input"
            type="password"
            placeholder="Senha"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {message && <p className="text-sm text-green-600">{message}</p>}
        <button type="submit" className="btn-brand w-full" disabled={loading}>
          {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link'}
        </button>
      </form>

      <div className="text-center text-sm space-y-2">
        {mode === 'login' ? (
          <>
            <button type="button" className="text-brand font-semibold block mx-auto" onClick={() => setMode('signup')}>
              Não tem conta? Cadastre-se
            </button>
            <button type="button" className="text-neutral-500 block mx-auto" onClick={() => setMode('reset')}>
              Esqueci minha senha
            </button>
          </>
        ) : (
          <button type="button" className="text-brand font-semibold" onClick={() => setMode('login')}>
            Já tenho conta — entrar
          </button>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
