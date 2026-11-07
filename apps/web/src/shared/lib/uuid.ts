// apps/web/src/shared/lib/uuid.ts — id генерирует клиент (офлайн-синк в v1.1)
// crypto.randomUUID есть только в secure context (https или localhost). На телефоне по http://192.168…:4200
// его нет — тогда собираем UUID v4 из crypto.getRandomValues, который работает везде.
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40; // версия 4
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80; // вариант RFC 4122
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
