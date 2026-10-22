import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { RecordingPart, ContinuousPlayerComponent } from '../../../shared/components/reproductor-continuo/reproductor-continuo';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import * as L from 'leaflet';
import {
  MyAlert, MyEvidence, MyEvidenceService, EvidenceType,
} from '../../../core/services/mis-evidencias.service';
import { GeocodingService } from '../../../core/services/geocoding.service';

type Filter = 'todas' | EvidenceType;

export const TYPES: Record<EvidenceType, { label: string; plural: string }> = {
  photo: { label: 'Foto', plural: 'Fotos' },
  video: { label: 'Video', plural: 'Videos' },
  audio: { label: 'Audio', plural: 'Audios' },
  document: { label: 'Documento', plural: 'Documentos' },
};

const STATUSES: Record<string, string> = {
  active: 'Activa', resolved: 'Atendida', cancelled: 'Cancelada', expired: 'Expirada',
};

const MAX_MB = 50;
// Solo lo que sirve como evidencia de una emergencia (los documentos ya subidos se siguen viendo)
const ACCEPTED = 'image/png,image/jpeg,image/webp,image/heic,video/*,audio/*';
const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
/** Días que se guardan las evidencias si la alerta no se marca para conservar (backend). */
export const RETENTION_DAYS = 60;
/** Máximo de alertas que se pueden conservar (backend: AlertService.MAX_ALERTAS_CONSERVADAS). */
export const MAX_KEPT = 5;

/** Alerta de la lista de la izquierda, con cuántas evidencias tiene. */
interface AlertWithEvidence extends MyAlert {
  count: number;
}

@Component({
  selector: 'app-evidence',
  standalone: true,
  imports: [CommonModule, FormsModule, ContinuousPlayerComponent],
  templateUrl: './evidence.html',
  styleUrl: './evidence.scss',
})
export class Evidence implements OnInit, OnDestroy {
  private service = inject(MyEvidenceService);
  private geocoding = inject(GeocodingService);
  private route = inject(ActivatedRoute);

  readonly types = TYPES;
  readonly accepted = ACCEPTED;
  readonly maxMb = MAX_MB;
  readonly retentionDays = RETENTION_DAYS;
  readonly maxKept = MAX_KEPT;

  evidences = signal<MyEvidence[]>([]);
  alerts = signal<MyAlert[]>([]);
  loading = signal(true);
  error = signal('');
  notice = signal('');

  /** Alerta elegida en la lista: solo se muestran sus evidencias. */
  alertaId = signal<number | null>(null);
  searchAlert = signal('');
  onlyWithEvidence = signal(true);
  filter = signal<Filter>('todas');
  /** Barrio y dirección de cada alerta (se resuelven al mostrarse). */
  addresses = signal<Record<number, string>>({});

  // ── Visor ──────────────────────────────────────
  selected = signal<MyEvidence | null>(null);
  urlVisor = signal<string | null>(null);
  loadingViewer = signal(false);
  errorVisor = signal('');
  private thumbnails = signal<Record<number, string>>({});
  /** Archivo ya descargado de cada evidencia (para no pedirlo dos veces). */
  private files: Record<number, string> = {};

  // ── Grabación completa (partes seguidas) ───────
  continua = signal<{ tipo: 'video' | 'audio'; parts: RecordingPart[] } | null>(null);
  loadingContinuous = signal(false);
  private createdUrls = new Set<string>();

  // ── Renombrar ──────────────────────────────────
  editingName = signal(false);
  newName = signal('');
  savingName = signal(false);

  // ── Mapa de la alerta ──────────────────────────
  mapVisible = signal(false);
  @ViewChild('mapaAlerta') private mapRef?: ElementRef<HTMLDivElement>;
  private map: L.Map | null = null;

  // ── Subida ─────────────────────────────────────
  uploadVisible = signal(false);
  file = signal<File | null>(null);
  progress = signal<number | null>(null);
  uploadError = signal('');
  dragging = signal(false);

  /** Todas las alertas de la usuaria (más recientes primero) con su número de evidencias. */
  alertList = computed<AlertWithEvidence[]>(() => {
    const count = new Map<number, number>();
    for (const e of this.evidences()) count.set(e.alertId, (count.get(e.alertId) ?? 0) + 1);
    // Alertas con evidencias que no vinieron en la lista de alertas
    const known = new Map<number, MyAlert>(this.alerts().map((a) => [a.id, a]));
    for (const e of this.evidences()) {
      if (!known.has(e.alertId) && e.alert) {
        known.set(e.alertId, {
          id: e.alertId, estado: e.alert.estado, method: e.alert.method,
          start: e.alert.start ?? e.fecha, lat: e.alert.lat, lng: e.alert.lng, keep: false,
        });
      }
    }
    return [...known.values()]
      .map((a) => ({ ...a, count: count.get(a.id) ?? 0 }))
      .sort((a, b) => b.start.getTime() - a.start.getTime());
  });

  filteredAlerts = computed(() => {
    const term = this.searchAlert().trim().toLowerCase();
    return this.alertList().filter((a) => {
      if (this.onlyWithEvidence() && a.count === 0 && a.id !== this.alertaId()) return false;
      if (!term) return true;
      return [this.longDate(a.start), this.estado(a.estado), this.addresses()[a.id] ?? '', `#${a.id}`]
        .some((t) => t.toLowerCase().includes(term));
    });
  });

  currentAlert = computed(() => this.alertList().find((a) => a.id === this.alertaId()) ?? null);

  private ofTheAlert = computed(() => this.evidences().filter((e) => e.alertId === this.alertaId()));

  count = computed(() => {
    const c = { photo: 0, video: 0, audio: 0, document: 0 } as Record<EvidenceType, number>;
    for (const e of this.ofTheAlert()) c[e.tipo]++;
    return c;
  });

  /** Pestañas visibles: solo los tipos que tiene la alerta. */
  visibleTypes = computed(() => (Object.keys(TYPES) as EvidenceType[]).filter((t) => this.count()[t] > 0));

  filtered = computed(() => {
    const filter = this.filter();
    return this.ofTheAlert()
      .filter((e) => filter === 'todas' || e.tipo === filter)
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  });

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.createdUrls.forEach((u) => URL.revokeObjectURL(u));
    this.map?.remove();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    // "Mis emergencias" abre este módulo con ?alertaId=ID
    const requested = Number(this.route.snapshot.queryParamMap.get('alertaId')) || null;
    this.service.myAlerts().subscribe({
      next: (a) => {
        this.alerts.set(a);
        this.resolveAddresses();
      },
      error: () => {},
    });
    this.service.list().subscribe({
      next: (list) => {
        this.evidences.set(list);
        this.loading.set(false);
        const initial = requested ?? this.alertList().find((a) => a.count > 0)?.id ?? null;
        if (initial) this.chooseAlert(initial);
      },
      error: () => {
        this.error.set('No se pudieron cargar tus evidencias. Intenta de nuevo.');
        this.loading.set(false);
      },
    });
  }

  chooseAlert(id: number): void {
    this.alertaId.set(id);
    this.continua.set(null);
    this.filter.set('todas');
    this.closeEdit();
    const first = this.filtered()[0];
    if (first) this.show(first);
    else {
      this.selected.set(null);
      this.urlVisor.set(null);
    }
    this.filtered()
      .filter((e) => e.tipo === 'photo' && e.hasFile)
      .forEach((e) => this.loadThumbnail(e));
    this.resolveAddresses();
  }

  /** Barrio y dirección de las alertas de la lista (OpenStreetMap, de a una por segundo). */
  resolveAddresses(): void {
    for (const a of this.filteredAlerts().slice(0, 15)) {
      if (a.lat == null || a.lng == null || this.addresses()[a.id]) continue;
      this.geocoding.get(a.lat, a.lng).then((place) => {
        const text = place ? [place.neighborhood, place.address].filter(Boolean).join(' · ') || place.city : null;
        if (text) this.addresses.update((d) => ({ ...d, [a.id]: text }));
      });
    }
  }

  thumbnail(e: MyEvidence): string | null {
    return this.thumbnails()[e.id] ?? null;
  }

  private loadThumbnail(e: MyEvidence): void {
    if (this.thumbnail(e)) return;
    this.service.file(e.id).subscribe({
      next: (blob) => this.thumbnails.update((m) => ({ ...m, [e.id]: this.createUrl(blob) })),
      error: () => {},
    });
  }

  /** Descarga todas las partes de un tipo y las muestra en el reproductor continuo. */
  showContinuous(tipo: 'video' | 'audio'): void {
    const parts = this.ofTheAlert()
      .filter((e) => e.tipo === tipo && e.hasFile)
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    if (parts.length === 0) return;
    this.selected.set(null);
    this.closeEdit();
    this.loadingContinuous.set(true);
    const alert = this.alertaId();
    forkJoin(parts.map((e) => this.service.file(e.id))).subscribe({
      next: (blobs) => {
        if (this.alertaId() !== alert) return;
        this.continua.set({
          tipo,
          parts: parts.map((e, i) => {
            this.files[e.id] ??= this.createUrl(blobs[i]);
            return { id: e.id, url: this.files[e.id], created: e.fecha };
          }),
        });
        this.loadingContinuous.set(false);
      },
      error: () => {
        this.loadingContinuous.set(false);
        this.showNotice('No se pudieron cargar todas las partes de la grabación.');
      },
    });
  }

  // ── Visor ──────────────────────────────────────
  show(e: MyEvidence): void {
    this.continua.set(null);
    this.selected.set(e);
    this.closeEdit();
    this.errorVisor.set('');
    this.urlVisor.set(null);
    if (!e.hasFile) return;

    const enCache = this.thumbnail(e);
    if (enCache) {
      this.urlVisor.set(enCache);
      return;
    }
    this.loadingViewer.set(true);
    this.service.file(e.id).subscribe({
      next: (blob) => {
        if (this.selected()?.id !== e.id) return;
        const url = this.createUrl(blob);
        if (e.tipo === 'photo') this.thumbnails.update((m) => ({ ...m, [e.id]: url }));
        this.urlVisor.set(url);
        this.loadingViewer.set(false);
      },
      error: () => {
        this.loadingViewer.set(false);
        this.errorVisor.set('No se pudo abrir el archivo.');
      },
    });
  }

  download(e: MyEvidence): void {
    const open = (url: string) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = e.fileName;
      a.click();
    };
    const url = this.selected()?.id === e.id ? this.urlVisor() : this.thumbnail(e);
    if (url) return open(url);
    this.service.file(e.id).subscribe({ next: (blob) => open(this.createUrl(blob)) });
  }

  delete(e: MyEvidence): void {
    if (!confirm(`¿Eliminar "${e.fileName}"? Esta acción no se puede deshacer.`)) return;
    this.service.delete(e.id).subscribe({
      next: () => {
        this.evidences.set(this.evidences().filter((x) => x.id !== e.id));
        if (this.selected()?.id === e.id) {
          this.selected.set(null);
          this.urlVisor.set(null);
          const next = this.filtered()[0];
          if (next) this.show(next);
        }
        this.showNotice('Evidencia eliminada.');
      },
      error: () => this.showNotice('No se pudo eliminar la evidencia.'),
    });
  }

  copyFingerprint(e: MyEvidence): void {
    if (!e.sha256) return;
    navigator.clipboard?.writeText(e.sha256).then(() => this.showNotice('Huella SHA-256 copiada.'));
  }

  // ── Conservar ──────────────────────────────────
  savingKeep = signal(false);
  totalKept = computed(() => this.alertList().filter((a) => a.keep).length);

  /** Fecha en que se borrará la evidencia (si su alerta no está marcada para conservar). */
  deletionDate(e: MyEvidence): Date {
    return new Date(e.fecha.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
  }

  toggleKeep(alert: AlertWithEvidence): void {
    if (this.savingKeep()) return;
    const keep = !alert.keep;
    this.savingKeep.set(true);
    this.service.keep(alert.id, keep).subscribe({
      next: () => {
        this.alerts.update((l) => l.map((a) => (a.id === alert.id ? { ...a, keep } : a)));
        this.savingKeep.set(false);
        this.showNotice(keep
          ? 'Las evidencias de esta alerta se conservarán hasta que tú las borres.'
          : `Las evidencias de esta alerta se borrarán a los ${RETENTION_DAYS} días.`);
      },
      error: (err: HttpErrorResponse) => {
        this.savingKeep.set(false);
        this.showNotice(err.error?.message ?? 'No se pudo cambiar. Intenta de nuevo.');
      },
    });
  }

  // ── Renombrar ──────────────────────────────────
  /** Se edita el nombre sin la extensión; el servidor se la vuelve a poner. */
  editName(e: MyEvidence): void {
    this.newName.set(e.fileName.replace(/\.[a-z0-9]{1,5}$/i, ''));
    this.editingName.set(true);
  }

  closeEdit(): void {
    this.editingName.set(false);
    this.savingName.set(false);
  }

  saveName(e: MyEvidence): void {
    const nombre = this.newName().trim();
    if (!nombre || this.savingName()) return;
    this.savingName.set(true);
    this.service.rename(e.id, nombre).subscribe({
      next: (updated) => {
        this.evidences.update((l) => l.map((x) => (x.id === e.id ? { ...x, fileName: updated.fileName } : x)));
        this.selected.set({ ...e, fileName: updated.fileName });
        this.closeEdit();
        this.showNotice('Nombre actualizado.');
      },
      error: (err: HttpErrorResponse) => {
        this.savingName.set(false);
        this.showNotice(err.error?.message ?? 'No se pudo cambiar el nombre.');
      },
    });
  }

  // ── Mapa de la alerta (dentro de la app, con zoom) ─────
  openMap(): void {
    const a = this.currentAlert();
    if (a?.lat == null || a?.lng == null) return;
    const center: L.LatLngTuple = [a.lat, a.lng];
    this.mapVisible.set(true);
    setTimeout(() => {
      if (!this.mapRef) return;
      this.map?.remove();
      this.map = L.map(this.mapRef.nativeElement, { center, zoom: 17 });
      L.tileLayer(TILES, { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(this.map);
      L.circleMarker(center, { radius: 10, color: '#fff', weight: 3, fillColor: '#7c3aed', fillOpacity: 1 })
        .addTo(this.map)
        .bindPopup(this.addresses()[a.id] ?? 'Lugar de la alerta')
        .openPopup();
    }, 50);
  }

  closeMap(): void {
    this.mapVisible.set(false);
    this.map?.remove();
    this.map = null;
  }

  // ── Subida ─────────────────────────────────────
  openUpload(): void {
    this.uploadVisible.set(true);
    this.file.set(null);
    this.uploadError.set('');
    this.progress.set(null);
  }

  closeUpload(): void {
    if (this.progress() !== null) return; // no cerrar a mitad de la subida
    this.uploadVisible.set(false);
  }

  chooseFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.validateFile(input.files?.[0] ?? null);
    input.value = '';
  }

  drop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.validateFile(event.dataTransfer?.files?.[0] ?? null);
  }

  private validateFile(f: File | null): void {
    this.uploadError.set('');
    if (!f) return;
    if (!/^(image\/(png|jpeg|webp|heic)|video\/|audio\/)/.test(f.type)) {
      this.uploadError.set('Solo se permiten fotos, videos o audios.');
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      this.uploadError.set(`El archivo pesa ${this.size(f.size)}; el máximo es ${MAX_MB} MB.`);
      return;
    }
    this.file.set(f);
  }

  upload(): void {
    const f = this.file();
    const alertId = this.alertaId();
    if (!f || !alertId) return;
    this.progress.set(0);
    this.uploadError.set('');
    this.service.upload(f, alertId).subscribe({
      next: (ev) => {
        if (ev.type === HttpEventType.UploadProgress && ev.total) {
          this.progress.set(Math.round((ev.loaded / ev.total) * 100));
        } else if (ev.type === HttpEventType.Response && ev.body) {
          const newOne = this.service.fromApi(ev.body);
          this.evidences.update((l) => [newOne, ...l]);
          this.progress.set(null);
          this.uploadVisible.set(false);
          this.filter.set('todas');
          this.show(newOne);
          this.showNotice('Evidencia subida y protegida con su huella SHA-256.');
        }
      },
      error: (err: HttpErrorResponse) => {
        this.progress.set(null);
        this.uploadError.set(err.error?.message ?? 'No se pudo subir el archivo.');
      },
    });
  }

  // ── Formato ────────────────────────────────────
  size(bytes: number | null): string {
    if (bytes == null) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  shortDate(d: Date | null): string {
    return d ? d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  }

  longDate(d: Date | null): string {
    return d
      ? d.toLocaleString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      : '—';
  }

  time(d: Date | null): string {
    return d ? d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '';
  }

  estado(s: string | undefined): string {
    return s ? STATUSES[s] ?? s : '—';
  }

  private createUrl(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.createdUrls.add(url);
    return url;
  }

  private showNotice(text: string): void {
    this.notice.set(text);
    setTimeout(() => {
      if (this.notice() === text) this.notice.set('');
    }, 3500);
  }
}
