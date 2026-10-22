import { Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

/** Una parte de la grabación (la app sube el video y el audio en trozos de ~45 s). */
export interface RecordingPart {
  id: number;
  url: string;
  created: Date | null;
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
export class ContinuousPlayerComponent implements OnChanges {
  @Input({ required: true }) parts: RecordingPart[] = [];
  @Input({ required: true }) tipo: 'video' | 'audio' = 'video';

  @ViewChild('medio') private method?: ElementRef<HTMLMediaElement>;

  readonly index = signal(0);
  /** Avance de la parte actual, de 0 a 1. */
  readonly progress = signal(0);
  /** Duración de cada parte en segundos (se conoce al cargar cada una). */
  readonly durations = signal<Record<number, number>>({});
  private playing = false;

  readonly current = computed(() => this.parts[this.index()] ?? null);
  readonly totalDuration = computed(() => {
    const d = this.durations();
    const known = this.parts.filter((p) => d[p.id] != null);
    if (known.length === 0) return null;
    const sum = known.reduce((s, p) => s + d[p.id], 0);
    // Las que aún no cargan se estiman con el promedio de las conocidas
    return Math.round((sum / known.length) * this.parts.length);
  });

  ngOnChanges(changes: SimpleChanges): void {
    // El seguimiento se refresca cada pocos segundos y puede traer partes nuevas: si la que suena
    // sigue en la lista, se continúa con ella sin reiniciar el reproductor
    const previousOnes: RecordingPart[] = changes['partes']?.previousValue ?? [];
    const currentId = previousOnes[this.index()]?.id;
    const samePart = currentId != null ? this.parts.findIndex((p) => p.id === currentId) : -1;
    if (samePart >= 0 && !changes['tipo']) {
      this.index.set(samePart);
      return;
    }
    this.index.set(0);
    this.progress.set(0);
    this.durations.set({});
    this.playing = false;
  }

  onLoad(): void {
    const el = this.method?.nativeElement;
    const part = this.current();
    if (el && part && Number.isFinite(el.duration)) {
      this.durations.update((d) => ({ ...d, [part.id]: el.duration }));
    }
    // Al pasar de una parte a la siguiente se sigue reproduciendo sin que la usuaria toque nada
    if (this.playing) el?.play().catch(() => {});
  }

  onAdvance(): void {
    const el = this.method?.nativeElement;
    if (el && el.duration > 0) this.progress.set(el.currentTime / el.duration);
  }

  onPlay(): void {
    this.playing = true;
  }

  onPause(): void {
    const el = this.method?.nativeElement;
    // "pause" también llega justo antes de "ended": ahí no se considera una pausa de la usuaria
    if (el && !el.ended) this.playing = false;
  }

  onEnd(): void {
    if (this.index() < this.parts.length - 1) {
      this.playing = true;
      this.irA(this.index() + 1);
    } else {
      this.playing = false;
    }
  }

  irA(i: number): void {
    if (i === this.index()) return;
    this.index.set(i);
    this.progress.set(0);
  }

  fill(i: number): number {
    if (i < this.index()) return 100;
    if (i > this.index()) return 0;
    return Math.round(this.progress() * 100);
  }

  minutos(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
}
