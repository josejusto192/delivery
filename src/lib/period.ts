export type Period = '24h' | 'today' | 'yesterday' | '7d' | '30d' | 'week' | 'month' | 'custom';

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '24h', label: 'Últimas 24h' },
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'week', label: 'Esta semana' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: 'month', label: 'Este mês' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'custom', label: 'Personalizado' },
];

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function rangeFor(period: Period, customFrom: string, customTo: string): { from: Date; to: Date } {
  const now = new Date();
  switch (period) {
    case '24h':
      return { from: new Date(now.getTime() - 24 * 3600 * 1000), to: now };
    case 'today':
      return { from: startOfDay(now), to: now };
    case 'yesterday': {
      const y = startOfDay(now);
      y.setDate(y.getDate() - 1);
      const end = startOfDay(now);
      return { from: y, to: end };
    }
    case '7d':
      return { from: new Date(now.getTime() - 7 * 86400 * 1000), to: now };
    case '30d':
      return { from: new Date(now.getTime() - 30 * 86400 * 1000), to: now };
    case 'week': {
      const day = startOfDay(now);
      const weekday = (day.getDay() + 6) % 7; // segunda = 0
      day.setDate(day.getDate() - weekday);
      return { from: day, to: now };
    }
    case 'month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: first, to: now };
    }
    case 'custom': {
      const from = customFrom ? startOfDay(new Date(customFrom)) : startOfDay(now);
      const to = customTo ? new Date(new Date(customTo).getTime() + 86400 * 1000) : now;
      return { from, to };
    }
  }
}
