import { TPipe } from '../../../core/i18n/i18n';
import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, forwardRef, inject, input, output, signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

interface Cell {
  iso: string;
  day: number;
  ofMonth: boolean;
  today: boolean;
  disabled: boolean;
}

const aIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fromIso = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const [a, m, d] = iso.split('-').map(Number);
  return a && m && d ? new Date(a, m - 1, d) : null;
};

/**
 * Own date picker (the browser one looks different in each browser and does not follow the theme).
 * Works with 'YYYY-MM-DD' dates like <input type="date">: works with [(ngModel)] or with
 * [value] + (valueChange).
 */
@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [TPipe],
  templateUrl: './date-picker.html',
  styleUrl: './date-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DatePicker), multi: true }],
})
export class DatePicker implements ControlValueAccessor {
  private host = inject(ElementRef<HTMLElement>);

  readonly value = input<string | null | undefined>(undefined);
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly placeholder = input('Elegir fecha');
  readonly label = input('Fecha');
  /** Shows the "x" to remove the date. */
  readonly clearable = input(true);
  readonly valueChange = output<string | null>();

  private internal = signal<string | null>(null);
  private touchedByNgModel = signal(false);
  readonly selection = computed(() => (this.touchedByNgModel() ? this.internal() : (this.value() ?? this.internal())) || null);

  open = signal(false);
  /** First day of the month being viewed. */
  month = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly days = DAYS;

  readonly text = computed(() => {
    const d = fromIso(this.selection());
    return d ? d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  });

  readonly monthTitle = computed(() => `${MONTHS[this.month().getMonth()]} ${this.month().getFullYear()}`);

  readonly cells = computed<Cell[]>(() => {
    const start = this.month();
    const offset = (start.getDay() + 6) % 7; // the week starts on Monday
    const first = new Date(start.getFullYear(), start.getMonth(), 1 - offset);
    const today = aIso(new Date());
    const min = this.min();
    const max = this.max();
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i);
      const iso = aIso(d);
      return {
        iso,
        day: d.getDate(),
        ofMonth: d.getMonth() === start.getMonth(),
        today: iso === today,
        disabled: (!!min && iso < min) || (!!max && iso > max),
      };
    });
  });

  private onChange: (v: string | null) => void = () => {};
  private onTap: () => void = () => {};

  writeValue(v: string | null): void {
    this.touchedByNgModel.set(true);
    this.internal.set(v || null);
  }
  registerOnChange(fn: (v: string | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTap = fn;
  }

  toggle(): void {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    const d = fromIso(this.selection()) ?? fromIso(this.max()) ?? new Date();
    this.month.set(new Date(d.getFullYear(), d.getMonth(), 1));
    this.open.set(true);
  }

  moveMonth(delta: number): void {
    const m = this.month();
    this.month.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  choose(c: Cell): void {
    if (c.disabled) return;
    this.emit(c.iso);
    this.open.set(false);
  }

  today(): void {
    const iso = aIso(new Date());
    if ((this.min() && iso < this.min()!) || (this.max() && iso > this.max()!)) return;
    this.emit(iso);
    this.open.set(false);
  }

  clear(ev?: Event): void {
    ev?.stopPropagation();
    this.emit(null);
    this.open.set(false);
  }

  private emit(v: string | null): void {
    this.internal.set(v);
    this.onChange(v);
    this.onTap();
    this.valueChange.emit(v);
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(ev: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(ev.target as Node)) this.open.set(false);
  }

  @HostListener('keydown.escape')
  alEscape(): void {
    this.open.set(false);
  }
}
