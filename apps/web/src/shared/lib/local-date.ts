// apps/web/src/shared/lib/local-date.ts — дата в поясе устройства, а не UTC
export const todayLocal = (d = new Date()): string =>
  new Intl.DateTimeFormat('en-CA').format(d); // en-CA даёт 'YYYY-MM-DD'
