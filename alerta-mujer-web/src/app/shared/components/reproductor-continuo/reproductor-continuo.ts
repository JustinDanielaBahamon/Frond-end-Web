import { Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

/** A part of the recording (the app uploads video and audio in ~45 s chunks). */
export interface RecordingPart {
  id: number;
  url: string;
  created: Date | null;
}

/**
 * Plays the parts of a recording one after another, as if they were a single file: when one
 * ends the next starts. The bar shows every part and allows jumping to any of them.
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
  @Input({ required: true }) type: 'video' | 'audio' = 'video';

  @ViewChild('medio') private method?: ElementRef<HTMLMediaElement>;

  readonly index = signal(0);
  /** Progress of the current part, from 0 to 1. */
  readonly progress = signal(0);
  /** Duration of each part in seconds (known when each one loads). */
  readonly durations = signal<Record<number, number>>({});
  private playing = false;

  readonly current = computed(() => this.parts[this.index()] ?? null);
  readonly totalDuration = computed(() => {
    const d = this.durations();
    const known = this.parts.filter((p) => d[p.id] != null);
    if (known.length === 0) return null;
    const sum = known.reduce((s, p) => s + d[p.id], 0);
    // Those not loaded yet are estimated with the average of the known ones
    return Math.round((sum / known.length) * this.parts.length);
  });

  ngOnChanges(changes: SimpleChanges): void {
    // Tracking refreshes every few seconds and may bring new parts: if the playing one
    // is still in the list, it continues with it without restarting the player
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
    // When moving from one part to the next it keeps playing without the user touching anything
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
    // "pause" also arrives right before "ended": that is not considered a user pause
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

  minutes(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
}
