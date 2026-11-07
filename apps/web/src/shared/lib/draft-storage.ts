// apps/web/src/shared/lib/draft-storage.ts — черновики в localStorage
// localStorage может бросить (приватный режим, переполнение) — черновик это удобство, не источник правды.
export const draftStorage = {
  read<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  write(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* молча: без черновика приложение работает */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  },
};
