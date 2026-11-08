// apps/web/src/entities/workout/api/offline/outbox.db.ts — dexie 4.4.x: очередь неотправленных записей
import Dexie, { type EntityTable } from 'dexie';
import type { SetLog, Workout } from '@tracker/domain';

interface Base {
  seq?: number;          // автоинкремент = порядок отправки (FIFO)
  key: string;           // log.id / workout.id — повторная правка заменяет запись, а не дублирует
  createdAt: number;
}

export interface QueuedLog extends Base {
  kind: 'set-log';
  workout: Workout;      // вместе с логом: тренировка создаётся при отправке первого подхода
  log: SetLog;
}

export interface QueuedFinish extends Base {
  kind: 'finish';
  workout: Workout;
  finish: { cardioMin: number | null; note: string | null };
}

export type OutboxItem = QueuedLog | QueuedFinish;

class OutboxDb extends Dexie {
  outbox!: EntityTable<OutboxItem, 'seq'>;

  constructor() {
    super('workout-tracker');
    this.version(1).stores({ outbox: '++seq, key, kind' }); // индексы: seq (PK), key, kind
  }
}

export const outboxDb = new OutboxDb();
