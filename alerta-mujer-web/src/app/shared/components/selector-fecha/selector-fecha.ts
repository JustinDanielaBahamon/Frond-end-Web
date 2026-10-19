import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, forwardRef, inject, input, output, signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

interface Celda {
  iso: string;
  dia: number;
  delMes: boolean;
  hoy: boolean;
  deshabilitada: boolean;
}

const aIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const desdeIso = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const [a, m, d] = iso.split('-').map(Number);
  return a && m && d ? new Date(a, m - 1, d) : null;
};

/**
 * Selector de fecha propio (el del navegador se ve distinto en cada uno y no sigue el tema).
 * Trabaja con fechas 'AAAA-MM-DD' como <input type="date">: sirve con [(ngModel)] o con
 * [value] + (valueChange).
 */
@Component({
  selector: 'app-selector-fecha',
  standalone: true,
  templateUrl: './selector-fecha.html',
  styleUrl: './selector-fecha.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectorFecha), multi: true }],
})
export class SelectorFecha implements ControlValueAccessor {
  private host = inject(ElementRef<HTMLElement>);

  readonly value = input<string | null | undefined>(undefined);
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly placeholder = input('Elegir fecha');
  readonly etiqueta = input('Fecha');
  /** Muestra la "x" para quitar la fecha. */
  readonly limpiable = input(true);
  readonly valueChange = output<string | null>();

  private interno = signal<string | null>(null);
  private tocadoPorNgModel = signal(false);
  readonly seleccion = computed(() => (this.tocadoPorNgModel() ? this.interno() : (this.value() ?? this.interno())) || null);

  abierto = signal(false);
  /** Primer día del mes que se está mirando. */
  mes = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly dias = DIAS;

  readonly texto = computed(() => {
    const d = desdeIso(this.seleccion());
    return d ? d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  });

  readonly tituloMes = computed(() => `${MESES[this.mes().getMonth()]} ${this.mes().getFullYear()}`);

  readonly celdas = computed<Celda[]>(() => {
    const inicio = this.mes();
    const desfase = (inicio.getDay() + 6) % 7; // la semana empieza el lunes
    const primero = new Date(inicio.getFullYear(), inicio.getMonth(), 1 - desfase);
    const hoy = aIso(new Date());
    const min = this.min();
    const max = this.max();
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(primero.getFullYear(), primero.getMonth(), primero.getDate() + i);
      const iso = aIso(d);
      return {
        iso,
        dia: d.getDate(),
        delMes: d.getMonth() === inicio.getMonth(),
        hoy: iso === hoy,
        deshabilitada: (!!min && iso < min) || (!!max && iso > max),
      };
    });
  });

  private alCambiar: (v: string | null) => void = () => {};
  private alTocar: () => void = () => {};

  writeValue(v: string | null): void {
    this.tocadoPorNgModel.set(true);
    this.interno.set(v || null);
  }
  registerOnChange(fn: (v: string | null) => void): void {
    this.alCambiar = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  alternar(): void {
    if (this.abierto()) {
      this.abierto.set(false);
      return;
    }
    const d = desdeIso(this.seleccion()) ?? desdeIso(this.max()) ?? new Date();
    this.mes.set(new Date(d.getFullYear(), d.getMonth(), 1));
    this.abierto.set(true);
  }

  moverMes(delta: number): void {
    const m = this.mes();
    this.mes.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  elegir(c: Celda): void {
    if (c.deshabilitada) return;
    this.emitir(c.iso);
    this.abierto.set(false);
  }

  hoy(): void {
    const iso = aIso(new Date());
    if ((this.min() && iso < this.min()!) || (this.max() && iso > this.max()!)) return;
    this.emitir(iso);
    this.abierto.set(false);
  }

  limpiar(ev?: Event): void {
    ev?.stopPropagation();
    this.emitir(null);
    this.abierto.set(false);
  }

  private emitir(v: string | null): void {
    this.interno.set(v);
    this.alCambiar(v);
    this.alTocar();
    this.valueChange.emit(v);
  }

  @HostListener('document:click', ['$event'])
  alClickFuera(ev: MouseEvent): void {
    if (this.abierto() && !this.host.nativeElement.contains(ev.target as Node)) this.abierto.set(false);
  }

  @HostListener('keydown.escape')
  alEscape(): void {
    this.abierto.set(false);
  }
}
