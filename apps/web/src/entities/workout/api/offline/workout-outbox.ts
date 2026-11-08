// apps/web/src/entities/workout/api/offline/workout-outbox.ts — очередь + досылка. Angular 22, RxJS 7
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { SetLog, Workout } from '@tracker/domain';
import { exhaustMap, filter, from, fromEvent, interval, merge } from 'rxjs';
import { SupabaseWorkoutRepository } from '../supabase-workout.repository';
import { isNetworkError } from './network-error';
import { outboxDb, type OutboxItem, type QueuedFinish, type QueuedLog } from './outbox.db';

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

@Injectable({ providedIn: 'root' })
export class WorkoutOutbox {
  private readonly remote = inject(SupabaseWorkoutRepository);

  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly pending = signal(0);
  readonly syncing = signal(false);
  readonly lastError = signal<string | null>(null); // сервер отказал — не сеть; очередь стоит, пока не разберёмся

  constructor() {
    const destroy = inject(DestroyRef);

    fromEvent(window, 'online').pipe(takeUntilDestroyed(destroy)).subscribe(() => this.online.set(true));
    fromEvent(window, 'offline').pipe(takeUntilDestroyed(destroy)).subscribe(() => this.online.set(false));

    // Когда пробовать досылать: старт, сеть вернулась, вкладка снова видна, и раз в 30 с на всякий случай
    merge(
      from(this.refreshCount()), // старт: сначала узнать, есть ли что слать (очередь пережила перезагрузку)
      fromEvent(window, 'online'),
      fromEvent(document, 'visibilitychange').pipe(filter(() => document.visibilityState === 'visible')),
      interval(30_000),
    )
      .pipe(
        filter(() => navigator.onLine && this.pending() > 0 && this.lastError() === null),
        exhaustMap(() => from(this.flush())), // exhaustMap: пока идёт досылка, новые поводы игнорируем — без двойной отправки
        takeUntilDestroyed(destroy),
      )
      .subscribe();
  }

  async enqueueLog(workout: Workout, log: SetLog): Promise<void> {
    await this.put({ kind: 'set-log', key: log.id, workout, log, createdAt: Date.now() });
  }

  async enqueueFinish(workout: Workout, finish: QueuedFinish['finish']): Promise<void> {
    await this.put({ kind: 'finish', key: workout.id, workout, finish, createdAt: Date.now() });
  }

  /** Отправлено напрямую — старая версия из очереди уже не нужна (иначе досылка перезапишет новое старым) */
  async drop(kind: OutboxItem['kind'], key: string): Promise<void> {
    await outboxDb.outbox.where('key').equals(key).filter((i) => i.kind === kind).delete();
    await this.refreshCount();
  }

  async queuedLogs(workoutId: string): Promise<QueuedLog[]> {
    const all = await outboxDb.outbox.where('kind').equals('set-log').toArray();
    return all.filter((i): i is QueuedLog => i.kind === 'set-log' && i.workout.id === workoutId);
  }

  async queuedWorkouts(dayId: string, date: string): Promise<Workout[]> {
    const all = await outboxDb.outbox.toArray();
    return all.filter((i) => i.workout.dayId === dayId && i.workout.date === date).map((i) => i.workout);
  }

  async queuedFinish(workoutId: string): Promise<QueuedFinish | null> {
    const item = await outboxDb.outbox.where('key').equals(workoutId).filter((i) => i.kind === 'finish').first();
    return (item as QueuedFinish | undefined) ?? null;
  }

  /** Повторить после ошибки сервера (кнопка в индикаторе) */
  retry(): void {
    this.lastError.set(null);
    void this.flush();
  }

  /** По порядку: подходы раньше «Завершить» — тренировка создаётся первым подходом */
  async flush(): Promise<void> {
    if (this.syncing()) return;
    this.syncing.set(true);
    try {
      for (;;) {
        const item = await outboxDb.outbox.orderBy('seq').first();
        if (!item) break;
        try {
          if (item.kind === 'set-log') await this.remote.saveSetLog(item.workout, item.log);
          else await this.remote.finishWorkout(item.workout.id, item.finish);
          await outboxDb.outbox.delete(item.seq!);
          await this.refreshCount();
        } catch (e) {
          if (!isNetworkError(e)) this.lastError.set(message(e)); // сеть — тихо ждём следующего повода
          break;
        }
      }
    } finally {
      this.syncing.set(false);
    }
  }

  private async put(item: OutboxItem): Promise<void> {
    await outboxDb.transaction('rw', outboxDb.outbox, async () => {
      const existing = await outboxDb.outbox.where('key').equals(item.key).filter((i) => i.kind === item.kind).first();
      if (existing?.seq !== undefined) await outboxDb.outbox.update(existing.seq, item); // правка того же подхода — на месте
      else await outboxDb.outbox.add(item);
    });
    await this.refreshCount();
  }

  private async refreshCount(): Promise<void> {
    try {
      this.pending.set(await outboxDb.outbox.count());
    } catch {
      this.pending.set(0); // IndexedDB недоступна (приватный режим старого Safari) — живём без офлайна
    }
  }
}
