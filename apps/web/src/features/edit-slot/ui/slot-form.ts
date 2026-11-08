// apps/web/src/features/edit-slot/ui/slot-form.ts — слот программы: новый или правка; упражнение (в т.ч. своё), схема, старт, шаг
import { ChangeDetectionStrategy, Component, computed, input, type OnInit, output, signal } from '@angular/core';
import type { CatalogExercise, Equipment, ProgramSlot, SlotPatch } from '@web/entities/program';
import { formatKg } from '@web/shared/lib/format';
import { UiButton, UiNumberInput, UiStepper } from '@web/shared/ui';

const NEW = '__new__';

const EQUIPMENT: readonly { readonly value: Equipment; readonly label: string; readonly step: number | null }[] = [
  { value: 'barbell', label: 'Штанга', step: 2.5 },
  { value: 'dumbbell', label: 'Гантели', step: 2 },
  { value: 'machine', label: 'Тренажёр', step: 5 },
  { value: 'cable', label: 'Блок', step: 5 },
  { value: 'bodyweight', label: 'Свой вес', step: null },
];

@Component({
  selector: 'app-slot-form',
  imports: [UiButton, UiNumberInput, UiStepper],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="flex flex-col gap-4" (submit)="$event.preventDefault(); submit()">
      <div class="flex flex-col gap-2">
        <label [for]="id('ex')" class="text-sm font-medium">Упражнение</label>
        <select [id]="id('ex')" class="h-12 rounded-xl border border-stone-300 bg-white px-3 text-base"
                (change)="changeExercise($any($event.target).value)">
          @if (!slot()) { <option value="" disabled [selected]="exerciseId() === ''">Выбери упражнение</option> }
          @for (e of catalog(); track e.id) { <option [value]="e.id" [selected]="e.id === exerciseId()">{{ e.name }}</option> }
          <option [value]="NEW" [selected]="exerciseId() === NEW">＋ Своё упражнение…</option>
        </select>
        @if (exerciseId() === NEW) {
          <div class="flex flex-col gap-2 rounded-xl bg-stone-50 p-3">
            <label [for]="id('new-name')" class="text-[13px] text-stone-600">Название</label>
            <input [id]="id('new-name')" type="text" autocomplete="off" maxlength="80" placeholder="Например, Гакк-присед"
                   class="h-11 rounded-xl border border-stone-300 bg-white px-3 text-base" [value]="newName()" (input)="newName.set($any($event.target).value)" />
            <label [for]="id('new-eq')" class="text-[13px] text-stone-600">Снаряд</label>
            <select [id]="id('new-eq')" class="h-11 rounded-xl border border-stone-300 bg-white px-3 text-base" (change)="setEquipment($any($event.target).value)">
              @for (e of equipmentList; track e.value) { <option [value]="e.value" [selected]="e.value === newEquipment()">{{ e.label }}</option> }
            </select>
          </div>
        }
        @if (replaced()) {
          <p class="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
            Замена: прогрессия начнётся заново со стартового веса. Записи «{{ slot()?.name }}» останутся в истории.
          </p>
        }
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-stone-600">Подходы</span>
        <ui-stepper label="подходы" [min]="1" [max]="10" [value]="sets()" (valueChange)="sets.set($event)" />
      </div>
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-stone-600">Повторы от</span>
        <ui-stepper label="нижняя граница повторов" [min]="1" [max]="30" [value]="repMin()" (valueChange)="setMin($event)" />
      </div>
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-stone-600">Повторы до</span>
        <ui-stepper label="верхняя граница повторов" [min]="repMin()" [max]="30" [value]="repMax()" (valueChange)="repMax.set($event)" />
      </div>

      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between gap-3">
          <label [for]="id('start')" class="text-sm text-stone-600">{{ isBodyweight() ? 'Доп. вес, кг' : 'Стартовый вес, кг' }}</label>
          <ui-number-input [inputId]="id('start')" label="стартовый вес" [step]="effectiveStep() ?? 1"
                           [value]="startKg()" (valueChange)="startKg.set($event)" />
        </div>
        <p class="text-[13px] text-stone-500">Работает, пока по слоту нет записей. Дальше вес ведёт прогрессия — меняй его прямо при записи подхода.</p>
      </div>

      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between gap-3">
          <label [for]="id('step')" class="text-sm text-stone-600">Шаг прибавки, кг</label>
          <ui-number-input [inputId]="id('step')" label="шаг прибавки" [step]="0.5" [placeholder]="catalogStepLabel()"
                           [value]="stepKg()" (valueChange)="stepKg.set($event)" />
        </div>
        <p class="text-[13px] text-stone-500">
          Пусто — по каталогу{{ catalogStep() ? ': ' + kg(catalogStep()!) + ' кг' : ' (свой вес — прибавляем повторы)' }}.
        </p>
      </div>

      <label class="flex min-h-11 cursor-pointer items-center justify-between gap-3">
        <span class="flex flex-col">
          <span class="text-sm font-medium">Главное упражнение</span>
          <span class="text-[13px] text-stone-500">Бейдж «главное» в карточке дня</span>
        </span>
        <input type="checkbox" class="size-6 accent-[var(--color-accent)]" [checked]="isMain()" (change)="isMain.set($any($event.target).checked)" />
      </label>

      @if (problem(); as p) { <p role="alert" class="text-sm text-red-700">{{ p }}</p> }
      @if (error()) { <p role="alert" class="text-sm text-red-700">{{ error() }}</p> }

      <div class="flex gap-2">
        <button uiButton size="md" type="submit" class="flex-1" [disabled]="!valid() || !dirty() || pending()">
          {{ pending() ? 'Сохраняю…' : slot() ? 'Сохранить' : 'Добавить' }}
        </button>
        <button uiButton="secondary" size="md" type="button" class="flex-1" (click)="cancel.emit()">Отмена</button>
      </div>
      @if (slot() && removable()) {
        <button type="button" class="self-start text-sm font-medium text-red-700" (click)="remove.emit()">Убрать из дня</button>
      }
    </form>
  `,
})
export class SlotForm implements OnInit {
  readonly slot = input<ProgramSlot | null>(null); // null — новый слот
  readonly removable = input(true);
  readonly catalog = input<readonly CatalogExercise[]>([]);
  readonly pending = input(false);
  readonly error = input<string | null>(null);

  readonly save = output<SlotPatch>();
  readonly cancel = output<void>();
  readonly remove = output<void>();

  protected readonly NEW = NEW;
  protected readonly equipmentList = EQUIPMENT;
  protected readonly newName = signal('');
  protected readonly newEquipment = signal<Equipment>('machine');
  protected readonly kg = formatKg;
  protected readonly exerciseId = signal('');
  protected readonly sets = signal(3);
  protected readonly repMin = signal(8);
  protected readonly repMax = signal(12);
  protected readonly startKg = signal<number | null>(null);
  protected readonly stepKg = signal<number | null>(null);
  protected readonly isMain = signal(false);

  protected readonly exercise = computed(() => this.catalog().find((e) => e.id === this.exerciseId()) ?? null);
  protected readonly replaced = computed(() => {
    const s = this.slot();
    return s !== null && this.exerciseId() !== '' && this.exerciseId() !== s.exerciseId;
  });
  private readonly isNew = computed(() => this.exerciseId() === NEW);
  protected readonly isBodyweight = computed(() =>
    this.isNew() ? this.newEquipment() === 'bodyweight' : this.exercise()?.equipment === 'bodyweight');
  /** Шаг «по каталогу»: у своего упражнения — по снаряду */
  protected readonly catalogStep = computed(() =>
    this.isNew() ? (EQUIPMENT.find((e) => e.value === this.newEquipment())?.step ?? null) : (this.exercise()?.defaultStepKg ?? null));
  protected readonly effectiveStep = computed(() => this.stepKg() ?? this.catalogStep());
  protected readonly catalogStepLabel = computed(() => {
    const d = this.catalogStep();
    return d ? formatKg(d) : '—';
  });

  protected readonly problem = computed<string | null>(() => {
    if (this.isNew()) {
      const name = this.newName().trim();
      if (!name) return 'Назови упражнение.';
      if (this.catalog().some((e) => e.name.toLowerCase() === name.toLowerCase())) return 'Такое упражнение уже есть — выбери его в списке.';
    }
    if (this.repMax() < this.repMin()) return 'Верх диапазона меньше низа.';
    const step = this.stepKg();
    if (step !== null && step <= 0) return 'Шаг должен быть больше нуля — или оставь пустым.';
    return null;
  });

  protected readonly valid = computed(() => this.exerciseId() !== '' && this.problem() === null);

  protected readonly dirty = computed(() => {
    const s = this.slot();
    if (!s) return true; // новый слот — сохранять можно сразу после выбора упражнения
    return (
      this.exerciseId() !== s.exerciseId || this.sets() !== s.sets || this.repMin() !== s.repMin ||
      this.repMax() !== s.repMax || this.startKg() !== s.startKg || this.stepKg() !== s.ownStepKg || this.isMain() !== s.isMain
    );
  });

  ngOnInit(): void {
    const s = this.slot();
    if (!s) return; // новый: дефолты сигналов — 3 × 8–12
    this.exerciseId.set(s.exerciseId);
    this.sets.set(s.sets);
    this.repMin.set(s.repMin);
    this.repMax.set(s.repMax);
    this.startKg.set(s.startKg);
    this.stepKg.set(s.ownStepKg);
    this.isMain.set(s.isMain);
  }

  /** id полей уникальны на странице: форм может быть несколько (по слоту) */
  protected id(name: string): string {
    return `slot-${this.slot()?.id ?? 'new'}-${name}`;
  }

  protected setEquipment(v: Equipment): void {
    this.newEquipment.set(v);
    this.stepKg.set(null); // шаг — по новому снаряду
  }

  protected changeExercise(id: string): void {
    this.exerciseId.set(id);
    const s = this.slot();
    if (s && id === s.exerciseId) {
      this.startKg.set(s.startKg); // вернул как было — вернуть и цифры
      this.stepKg.set(s.ownStepKg);
      return;
    }
    this.startKg.set(null); // вес старого упражнения к новому не относится
    this.stepKg.set(null);  // шаг — из каталога нового
  }

  /** Низ поднялся выше верха → тянем верх за собой */
  protected setMin(v: number): void {
    this.repMin.set(v);
    if (this.repMax() < v) this.repMax.set(v);
  }

  protected submit(): void {
    if (!this.valid() || !this.dirty()) return;
    const name = this.newName().trim();
    this.save.emit({
      newExercise: this.isNew() ? { name, equipment: this.newEquipment(), defaultStepKg: this.catalogStep() } : null,
      exerciseId: this.isNew() ? '' : this.exerciseId(),
      sets: this.sets(),
      repMin: this.repMin(),
      repMax: this.repMax(),
      startKg: this.startKg(),
      stepKg: this.stepKg(),
      isMain: this.isMain(),
    });
  }
}
