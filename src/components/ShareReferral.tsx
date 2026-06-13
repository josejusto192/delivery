'use client';

import { useState } from 'react';

export default function ShareReferral({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/conta/entrar?ref=${code}` : '';

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Indicação', text: `Use meu código ${code} e ganhe desconto!`, url: link });
    } else {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="card p-5 space-y-3 text-center">
      <p className="text-sm text-neutral-500">Seu código de indicação</p>
      <button onClick={copy} className="w-full border border-dashed border-brand rounded-lg py-3 font-bold text-lg text-brand">
        {code}
      </button>
      <p className="text-xs text-neutral-400">{copied ? 'Copiado ✓' : 'toque para copiar'}</p>
      <button onClick={share} className="btn-brand w-full">
        Compartilhar código
      </button>
    </div>
  );
}
