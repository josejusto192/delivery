'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Ícone ⓘ que abre uma explicação curta ao clicar/tocar.
 * Feito para funcionar em touch (não depende de hover).
 */
export default function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-block align-middle">
      <button
        type="button"
        aria-label="Mais informações"
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className={`h-4 w-4 inline-grid place-items-center rounded-full text-[10px] font-bold leading-none transition-colors ${
          open ? 'bg-neutral-700 text-white' : 'bg-neutral-200 text-neutral-500 hover:bg-neutral-300'
        }`}
      >
        i
      </button>
      {open && (
        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-30 w-60 rounded-lg bg-neutral-800 text-white text-xs font-normal normal-case tracking-normal p-2.5 shadow-lg block">
          {text}
          <span className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-neutral-800" />
        </span>
      )}
    </span>
  );
}
