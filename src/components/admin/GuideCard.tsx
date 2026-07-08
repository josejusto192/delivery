'use client';

import { useEffect, useState } from 'react';

/**
 * Guia "Como funciona" recolhível. Começa aberto na primeira visita;
 * ao fechar, lembra a escolha (localStorage) e vira um link discreto.
 */
export default function GuideCard({
  id,
  title,
  steps,
}: {
  id: string;
  title: string;
  steps: string[];
}) {
  const storageKey = `guide-dismissed-${id}`;
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(storageKey) !== '1');
    } catch {
      setOpen(true);
    }
    setReady(true);
  }, [storageKey]);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem(storageKey, next ? '0' : '1');
      } catch {}
      return next;
    });
  };

  if (!ready) return null;

  if (!open) {
    return (
      <button type="button" onClick={toggle} className="text-xs font-semibold text-brand">
        💡 {title}
      </button>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-sm text-blue-900">💡 {title}</h3>
        <button
          type="button"
          onClick={toggle}
          className="text-blue-400 hover:text-blue-700 text-xs font-semibold shrink-0"
        >
          Entendi, ocultar
        </button>
      </div>
      <ol className="mt-2 space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm text-blue-900/80">
            <span className="h-5 w-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold grid place-items-center shrink-0 mt-px">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
