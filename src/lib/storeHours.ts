import type { StoreSettings } from './types';

export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_LABELS: Record<DayKey, string> = {
  sun: 'Domingo',
  mon: 'Segunda',
  tue: 'Terça',
  wed: 'Quarta',
  thu: 'Quinta',
  fri: 'Sexta',
  sat: 'Sábado',
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * true/false se há horários configurados; null se não há (não interfere).
 * Suporta intervalos que atravessam a meia-noite (ex.: 18:00–02:00).
 */
export function isWithinOpeningHours(
  hours: StoreSettings['opening_hours'] | null | undefined,
  date: Date = new Date()
): boolean | null {
  if (!hours) return null;
  const configured = Object.values(hours).some((arr) => (arr ?? []).length > 0);
  if (!configured) return null;

  const minutes = date.getHours() * 60 + date.getMinutes();
  const today = DAY_KEYS[date.getDay()];
  const yesterday = DAY_KEYS[(date.getDay() + 6) % 7];

  const inInterval = ([start, end]: [string, string], offset = 0) => {
    const s = toMinutes(start);
    const e = toMinutes(end);
    const m = minutes + offset;
    return e >= s ? m >= s && m < e : m >= s || m < e - 0; // e < s: atravessa meia-noite
  };

  // intervalos de hoje
  if ((hours[today] ?? []).some((iv) => inInterval(iv))) return true;
  // intervalos de ontem que atravessam a meia-noite (ex.: sáb 20:00–02:00, agora dom 01:00)
  if (
    (hours[yesterday] ?? []).some(([s, e]) => toMinutes(e) < toMinutes(s) && minutes < toMinutes(e))
  )
    return true;
  return false;
}

/** Loja aberta = chave manual ligada E (sem horários configurados OU dentro do horário) */
export function isStoreOpenNow(settings: StoreSettings | null | undefined, date?: Date): boolean {
  if (!settings?.is_open) return false;
  return isWithinOpeningHours(settings.opening_hours, date) !== false;
}
