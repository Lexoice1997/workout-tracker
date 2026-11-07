// apps/web/src/features/finish-workout/ui/finish-panel.ts — итог тренировки: кардио + заметка
import { ChangeDetectionStrategy, Component, inject, input, type OnInit, output, signal } from '@angular/core';
import type { Workout } from '@tracker/domain';
import { WorkoutRepository } from '@web/entities/workout';
import { UiButton, UiStepper } from '@web/shared/ui';

@Component({
  selector: 'app-finish-panel',
  imports: [UiButton, UiStepper],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-4" aria-labelledby="finish-title">
      <h2 id="finish-title" class="text-base font-semibold">Завершить тренировку</h2>
      <p class="text-[13px] text-stone-600">Записано {{ logged() }} из {{ total() }} упражнений</p>

      <div class="flex flex-col gap-2">
        <span class="text-sm font-medium">Кардио после силовой</span>
        <div class="flex gap-2">
          <button type="button" (click)="withCardio.set(true)" [attr.aria-pressed]="withCardio()"
                  class="h-11 flex-1 rounded-xl border border-stone-300 bg-white text-sm font-medium aria-pressed:border-2 aria-pressed:border-accent aria-pressed:bg-accent-soft">Дорожка</button>
          <button type="button" (click)="withCardio.set(false)" [attr.aria-pressed]="!withCardio()"
                  class="h-11 flex-1 rounded-xl border border-stone-300 bg-white text-sm font-medium aria-pressed:border-2 aria-pressed:border-accent aria-pressed:bg-accent-soft">Без кардио</button>
        </div>
        @if (withCardio()) {
          <div class="flex items-center justify-between">
            <span class="text-sm text-stone-600">Минуты</span>
            <ui-stepper label="минуты кардио" [step]="5" [max]="180" [value]="minutes()" (valueChange)="minutes.set($event)" />
          </div>
        }
      </div>

      <div class="flex flex-col gap-2">
        <label for="finish-note" class="text-sm font-medium">Заметка</label>
        <textarea id="finish-note" rows="3" maxlength="500" placeholder="Самочувствие, что поменять"
                  [value]="note()" (input)="note.set($any($event.target).value)"
                  class="resize-none rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-[15px] outline-none
                         focus:border-accent focus:ring-2 focus:ring-accent/30"></textarea>
      </div>

      @if (error(); as e) { <p role="alert" class="text-sm text-red-700">Не сохранилось: {{ e }}</p> }

      <button uiButton type="button" [disabled]="pending()" (click)="save()">
        {{ pending() ? 'Сохраняю…' : 'Сохранить и завершить' }}
      </button>
    </section>
  `,
})
export class FinishPanel implements OnInit {
  private readonly repo = inject(WorkoutRepository);

  readonly workout = input.required<Workout>();
  readonly logged = input(0);
  readonly total = input(0);
  readonly finished = output<Workout>();

  protected readonly withCardio = signal(true);
  protected readonly minutes = signal(20); // по программе: 15–20 мин дорожки после силовой
  protected readonly note = signal('');
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void { // повторное завершение — подставляем прошлый итог
    const w = this.workout();
    if (w.finishedAt) {
      this.withCardio.set((w.cardioMin ?? 0) > 0);
      if (w.cardioMin) this.minutes.set(w.cardioMin);
      this.note.set(w.note ?? '');
    }
  }

  protected async save(): Promise<void> {
    if (this.pending()) return; // двойной тап
    this.pending.set(true);
    this.error.set(null);
    try {
      const note = this.note().trim();
      const saved = await this.repo.finishWorkout(this.workout().id, {
        cardioMin: this.withCardio() ? this.minutes() : 0,
        note: note === '' ? null : note,
      });
      this.finished.emit(saved);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.pending.set(false);
    }
  }
}
