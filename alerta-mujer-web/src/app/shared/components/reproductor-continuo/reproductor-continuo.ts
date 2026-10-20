import { Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

/** Una parte de la grabación (la app sube el video y el audio en trozos de ~45 s). */
export interface ParteGrabacion {
  id: number;
  url: string;
  creada: Date | null;
}

/**
 * Reproduce las partes de una grabación una tras otra, como si fueran un solo archivo: al terminar
 * una empieza la siguiente. La barra muestra todas las partes y permite saltar a cualquiera.
 */
@Component({
  selector: 'app-reproductor-continuo',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './reproductor-continuo.html',
  styleUrl: './reproductor-continuo.scss',
})
export class ReproductorContinuoComponent implements OnChanges {
  @Input({ required: true }) partes: ParteGrabacion[] = [];
  @Input({ required: true }) tipo: 'video' | 'audio' = 'video';

  @ViewChild('medio') private medio?: ElementRef<HTMLMediaElement>;

  readonly indice = signal(0);
  /** Avance de la parte actual, de 0 a 1. */
  readonly avance = signal(0);
  /** Duración de cada parte en segundos (se conoce al cargar cada una). */
  readonly duraciones = signal<Record<number, number>>({});
  private reproduciendo = false;

  readonly actual = computed(() => this.partes[this.indice()] ?? null);
  readonly duracionTotal = computed(() => {
    const d = this.duraciones();
    const conocidas = this.partes.filter((p) => d[p.id] != null);
    if (conocidas.length === 0) return null;
    const suma = conocidas.reduce((s, p) => s + d[p.id], 0);
    // Las que aún no cargan se estiman con el promedio de las conocidas
    return Math.round((suma / conocidas.length) * this.partes.length);
  });

  ngOnChanges(cambios: SimpleChanges): void {
    // El seguimiento se refresca cada pocos segundos y puede traer partes nuevas: si la que suena
    // sigue en la lista, se continúa con ella sin reiniciar el reproductor
    const anteriores: ParteGrabacion[] = cambios['partes']?.previousValue ?? [];
    const idActual = anteriores[this.indice()]?.id;
    const mismaParte = idActual != null ? this.partes.findIndex((p) => p.id === idActual) : -1;
    if (mismaParte >= 0 && !cambios['tipo']) {
      this.indice.set(mismaParte);
      return;
    }
    this.indice.set(0);
    this.avance.set(0);
    this.duraciones.set({});
    this.reproduciendo = false;
  }

  alCargar(): void {
    const el = this.medio?.nativeElement;
    const parte = this.actual();
    if (el && parte && Number.isFinite(el.duration)) {
      this.duraciones.update((d) => ({ ...d, [parte.id]: el.duration }));
    }
    // Al pasar de una parte a la siguiente se sigue reproduciendo sin que la usuaria toque nada
    if (this.reproduciendo) el?.play().catch(() => {});
  }

  alAvanzar(): void {
    const el = this.medio?.nativeElement;
    if (el && el.duration > 0) this.avance.set(el.currentTime / el.duration);
  }

  alReproducir(): void {
    this.reproduciendo = true;
  }

  alPausar(): void {
    const el = this.medio?.nativeElement;
    // "pause" también llega justo antes de "ended": ahí no se considera una pausa de la usuaria
    if (el && !el.ended) this.reproduciendo = false;
  }

  alTerminar(): void {
    if (this.indice() < this.partes.length - 1) {
      this.reproduciendo = true;
      this.irA(this.indice() + 1);
    } else {
      this.reproduciendo = false;
    }
  }

  irA(i: number): void {
    if (i === this.indice()) return;
    this.indice.set(i);
    this.avance.set(0);
  }

  relleno(i: number): number {
    if (i < this.indice()) return 100;
    if (i > this.indice()) return 0;
    return Math.round(this.avance() * 100);
  }

  minutos(segundos: number): string {
    const m = Math.floor(segundos / 60);
    const s = Math.round(segundos % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
}
