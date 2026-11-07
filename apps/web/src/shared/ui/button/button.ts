// apps/web/src/shared/ui/button/button.ts — UI-кит: кнопка как атрибут на нативном <button>/<a>
import { computed, Directive, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'disabled:pointer-events-none disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-strong',
  secondary: 'border border-stone-300 bg-white text-stone-900 hover:bg-stone-50',
  ghost: 'text-stone-900 hover:bg-stone-200/60',
  danger: 'border border-stone-300 bg-white text-red-700 hover:bg-red-50',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'h-11 px-4 text-[15px]', // 44 px — минимум под палец
  lg: 'h-13 px-5 text-base',   // 52 px — главная кнопка экрана
};

/**
 * <button uiButton>Готово</button>
 * <button uiButton="secondary" size="md">Отмена</button>
 */
@Directive({
  selector: 'button[uiButton], a[uiButton]',
  host: { '[class]': 'classes()' }, // сливается со статическим class="" на элементе
})
export class UiButton {
  /** uiButton без значения = '' → primary */
  readonly variant = input<ButtonVariant, ButtonVariant | ''>('primary', {
    alias: 'uiButton',
    transform: (v) => v || 'primary',
  });
  readonly size = input<ButtonSize>('lg');

  protected readonly classes = computed(() => `${BASE} ${VARIANTS[this.variant()]} ${SIZES[this.size()]}`);
}
