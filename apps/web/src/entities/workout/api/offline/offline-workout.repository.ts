// apps/web/src/entities/workout/api/offline/offline-workout.repository.ts
// Декоратор над Supabase: запись без сети уходит в очередь, чтение подмешивает очередь.
import { inject, Injectable } from '@angular/core';
import type { ActiveProgram, IsoDate, PlanSlot, SetLog, Workout } from '@tracker/domain';
import type { HistoryEntry } from '../../lib/workout.mapper';
import { SupabaseWorkoutRepository } from '../supabase-workout.repository';
import { WorkoutRepository, type DayWorkout } from '../workout.repository';
import { isNetworkError } from './network-error';
import { WorkoutOutbox } from './workout-outbox';

@Injectable()
export class OfflineWorkoutRepository extends WorkoutRepository {
  private readonly remote = inject(SupabaseWorkoutRepository);
  private readonly outbox = inject(WorkoutOutbox);
  private readonly known = new Map<string, Workout>(); // для оптимистичного ответа finishWorkout

  override activeProgram(): Promise<ActiveProgram | null> {
    return this.remote.activeProgram();
  }

  override slotsByDay(dayId: string): Promise<PlanSlot[]> {
    return this.remote.slotsByDay(dayId);
  }

  override lastNormalLogs(slotIds: readonly string[]): Promise<SetLog[]> {
    return this.remote.lastNormalLogs(slotIds);
  }

  override async dayWorkout(dayId: string, date: IsoDate): Promise<DayWorkout | null> {
    const server = await this.remote.dayWorkout(dayId, date); // без сети — из кэша service worker'а, если был
    const queuedWorkout = server?.workout ?? (await this.outbox.queuedWorkouts(dayId, date))[0] ?? null;
    if (!queuedWorkout) return null;

    const queued = await this.outbox.queuedLogs(queuedWorkout.id);
    const bySlot = new Map((server?.logs ?? []).map((l) => [l.slotId ?? l.id, l]));
    for (const q of queued) bySlot.set(q.log.slotId ?? q.log.id, q.log); // из очереди — новее серверного
    const finish = await this.outbox.queuedFinish(queuedWorkout.id);
    const workout: Workout = finish
      ? { ...queuedWorkout, ...finish.finish, finishedAt: finish.workout.finishedAt }
      : queuedWorkout;

    this.known.set(workout.id, workout);
    return { workout, logs: [...bySlot.values()] };
  }

  override async saveSetLog(workout: Workout, log: SetLog): Promise<SetLog> {
    this.known.set(workout.id, workout);
    if (!navigator.onLine) return this.queueLog(workout, log);
    try {
      const saved = await this.remote.saveSetLog(workout, log);
      await this.outbox.drop('set-log', log.id);
      return saved;
    } catch (e) {
      if (isNetworkError(e)) return this.queueLog(workout, log);
      throw e;
    }
  }

  override async finishWorkout(workoutId: string, finish: { cardioMin: number | null; note: string | null }): Promise<Workout> {
    const workout = this.known.get(workoutId);
    const optimistic = async (): Promise<Workout> => {
      if (!workout) throw new Error('Нет сети. Заверши тренировку, когда появится связь.');
      const done: Workout = { ...workout, ...finish, finishedAt: new Date().toISOString() };
      await this.outbox.enqueueFinish(done, finish);
      this.known.set(workoutId, done);
      return done;
    };
    if (!navigator.onLine) return optimistic();
    try {
      const saved = await this.remote.finishWorkout(workoutId, finish);
      await this.outbox.drop('finish', workoutId);
      return saved;
    } catch (e) {
      if (isNetworkError(e)) return optimistic();
      throw e;
    }
  }

  override history(limit?: number): Promise<HistoryEntry[]> {
    return this.remote.history(limit);
  }

  override deleteWorkout(workoutId: string): Promise<void> {
    return this.remote.deleteWorkout(workoutId);
  }

  private async queueLog(workout: Workout, log: SetLog): Promise<SetLog> {
    await this.outbox.enqueueLog(workout, log);
    return log; // в базу уйдёт тот же объект: id сгенерированы на клиенте, upsert идемпотентен
  }
}
