import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import {
  MiAlerta, MiEvidencia, MisEvidenciasService, TipoEvidencia,
} from '../../../core/services/mis-evidencias.service';

type Filtro = 'todas' | TipoEvidencia;
type Orden = 'recientes' | 'antiguas';

export const TIPOS: Record<TipoEvidencia, { etiqueta: string; plural: string }> = {
  photo: { etiqueta: 'Foto', plural: 'Fotos' },
  video: { etiqueta: 'Video', plural: 'Videos' },
  audio: { etiqueta: 'Audio', plural: 'Audios' },
  document: { etiqueta: 'Documento', plural: 'Documentos' },
};

const ESTADOS: Record<string, string> = {
  active: 'Activa', resolved: 'Atendida', cancelled: 'Cancelada', expired: 'Expirada',
};

const MAX_MB = 50;
const ACEPTADOS = 'image/png,image/jpeg,image/webp,image/heic,video/*,audio/*,application/pdf';

@Component({
  selector: 'app-evidence',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './evidence.html',
  styleUrl: './evidence.scss',
})
export class Evidence implements OnInit, OnDestroy {
  private service = inject(MisEvidenciasService);

  readonly tipos = TIPOS;
  readonly listaTipos = Object.keys(TIPOS) as TipoEvidencia[];
  readonly aceptados = ACEPTADOS;
  readonly maxMb = MAX_MB;

  evidencias = signal<MiEvidencia[]>([]);
  cargando = signal(true);
  error = signal('');
  aviso = signal('');

  filtro = signal<Filtro>('todas');
  busqueda = signal('');
  orden = signal<Orden>('recientes');

  // ── Visor ──────────────────────────────────────
  seleccionada = signal<MiEvidencia | null>(null);
  urlVisor = signal<string | null>(null);
  cargandoVisor = signal(false);
  errorVisor = signal('');
  private miniaturas = signal<Record<number, string>>({});
  private urlsCreadas = new Set<string>();

  // ── Subida ─────────────────────────────────────
  subirVisible = signal(false);
  misAlertas = signal<MiAlerta[]>([]);
  alertaElegida = signal<number | null>(null);
  archivo = signal<File | null>(null);
  progreso = signal<number | null>(null);
  errorSubida = signal('');
  arrastrando = signal(false);

  conteo = computed(() => {
    const c = { photo: 0, video: 0, audio: 0, document: 0 } as Record<TipoEvidencia, number>;
    for (const e of this.evidencias()) c[e.tipo]++;
    return c;
  });

  filtradas = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const filtro = this.filtro();
    const lista = this.evidencias().filter((e) => {
      if (filtro !== 'todas' && e.tipo !== filtro) return false;
      if (!termino) return true;
      return [e.nombreArchivo, TIPOS[e.tipo].etiqueta, `#${e.alertId}`, this.fechaLarga(e.fecha)]
        .some((t) => t.toLowerCase().includes(termino));
    });
    const signo = this.orden() === 'recientes' ? -1 : 1;
    return [...lista].sort((a, b) => signo * (a.fecha.getTime() - b.fecha.getTime()));
  });

  /** Agrupadas por alerta, en el orden de la lista filtrada. */
  grupos = computed(() => {
    const grupos: { alertId: number; alerta: MiEvidencia['alerta']; items: MiEvidencia[] }[] = [];
    for (const e of this.filtradas()) {
      let g = grupos.find((x) => x.alertId === e.alertId);
      if (!g) grupos.push((g = { alertId: e.alertId, alerta: e.alerta, items: [] }));
      g.items.push(e);
    }
    return grupos;
  });

  ngOnInit(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    this.urlsCreadas.forEach((u) => URL.revokeObjectURL(u));
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.service.listar().subscribe({
      next: (lista) => {
        this.evidencias.set(lista);
        this.cargando.set(false);
        lista.filter((e) => e.tipo === 'photo' && e.tieneArchivo).slice(0, 30).forEach((e) => this.cargarMiniatura(e));
        if (!this.seleccionada() && lista.length) this.ver(lista[0]);
      },
      error: () => {
        this.error.set('No se pudieron cargar tus evidencias. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  miniatura(e: MiEvidencia): string | null {
    return this.miniaturas()[e.id] ?? null;
  }

  private cargarMiniatura(e: MiEvidencia): void {
    this.service.archivo(e.id).subscribe({
      next: (blob) => this.miniaturas.update((m) => ({ ...m, [e.id]: this.crearUrl(blob) })),
      error: () => {},
    });
  }

  // ── Visor ──────────────────────────────────────
  ver(e: MiEvidencia): void {
    this.seleccionada.set(e);
    this.errorVisor.set('');
    this.urlVisor.set(null);
    if (!e.tieneArchivo) return;

    const enCache = this.miniatura(e);
    if (enCache) {
      this.urlVisor.set(enCache);
      return;
    }
    this.cargandoVisor.set(true);
    this.service.archivo(e.id).subscribe({
      next: (blob) => {
        if (this.seleccionada()?.id !== e.id) return;
        const url = this.crearUrl(blob);
        if (e.tipo === 'photo') this.miniaturas.update((m) => ({ ...m, [e.id]: url }));
        this.urlVisor.set(url);
        this.cargandoVisor.set(false);
      },
      error: () => {
        this.cargandoVisor.set(false);
        this.errorVisor.set('No se pudo abrir el archivo.');
      },
    });
  }

  descargar(e: MiEvidencia): void {
    const abrir = (url: string) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = e.nombreArchivo;
      a.click();
    };
    const url = this.seleccionada()?.id === e.id ? this.urlVisor() : this.miniatura(e);
    if (url) return abrir(url);
    this.service.archivo(e.id).subscribe({ next: (blob) => abrir(this.crearUrl(blob)) });
  }

  eliminar(e: MiEvidencia): void {
    if (!confirm(`¿Eliminar "${e.nombreArchivo}"? Esta acción no se puede deshacer.`)) return;
    this.service.eliminar(e.id).subscribe({
      next: () => {
        const restantes = this.evidencias().filter((x) => x.id !== e.id);
        this.evidencias.set(restantes);
        if (this.seleccionada()?.id === e.id) {
          this.seleccionada.set(null);
          this.urlVisor.set(null);
          if (restantes.length) this.ver(this.filtradas()[0] ?? restantes[0]);
        }
        this.mostrarAviso('Evidencia eliminada.');
      },
      error: () => this.mostrarAviso('No se pudo eliminar la evidencia.'),
    });
  }

  copiarHuella(e: MiEvidencia): void {
    if (!e.sha256) return;
    navigator.clipboard?.writeText(e.sha256).then(() => this.mostrarAviso('Huella SHA-256 copiada.'));
  }

  // ── Subida ─────────────────────────────────────
  abrirSubida(): void {
    this.subirVisible.set(true);
    this.archivo.set(null);
    this.errorSubida.set('');
    this.progreso.set(null);
    this.service.misAlertas().subscribe({
      next: (alertas) => {
        this.misAlertas.set(alertas);
        this.alertaElegida.set(alertas[0]?.id ?? null);
      },
      error: () => this.errorSubida.set('No se pudieron cargar tus alertas.'),
    });
  }

  cerrarSubida(): void {
    if (this.progreso() !== null) return; // no cerrar a mitad de la subida
    this.subirVisible.set(false);
  }

  elegirArchivo(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.validarArchivo(input.files?.[0] ?? null);
    input.value = '';
  }

  soltar(event: DragEvent): void {
    event.preventDefault();
    this.arrastrando.set(false);
    this.validarArchivo(event.dataTransfer?.files?.[0] ?? null);
  }

  private validarArchivo(f: File | null): void {
    this.errorSubida.set('');
    if (!f) return;
    const tipoOk = /^(image\/(png|jpeg|webp|heic)|video\/|audio\/|application\/pdf$)/.test(f.type);
    if (!tipoOk) {
      this.errorSubida.set('Solo se permiten fotos, videos, audios o PDF.');
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      this.errorSubida.set(`El archivo pesa ${this.tamano(f.size)}; el máximo es ${MAX_MB} MB.`);
      return;
    }
    this.archivo.set(f);
  }

  subir(): void {
    const f = this.archivo();
    const alertId = this.alertaElegida();
    if (!f || !alertId) return;
    this.progreso.set(0);
    this.errorSubida.set('');
    this.service.subir(f, alertId).subscribe({
      next: (ev) => {
        if (ev.type === HttpEventType.UploadProgress && ev.total) {
          this.progreso.set(Math.round((ev.loaded / ev.total) * 100));
        } else if (ev.type === HttpEventType.Response && ev.body) {
          const nueva = this.service.desdeApi(ev.body);
          this.evidencias.update((l) => [nueva, ...l]);
          this.progreso.set(null);
          this.subirVisible.set(false);
          this.filtro.set('todas');
          this.ver(nueva);
          this.mostrarAviso('Evidencia subida y protegida con su huella SHA-256.');
        }
      },
      error: (err: HttpErrorResponse) => {
        this.progreso.set(null);
        this.errorSubida.set(err.error?.message ?? 'No se pudo subir el archivo.');
      },
    });
  }

  // ── Formato ────────────────────────────────────
  tamano(bytes: number | null): string {
    if (bytes == null) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  fechaCorta(d: Date | null): string {
    return d ? d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  }

  fechaLarga(d: Date | null): string {
    return d
      ? d.toLocaleString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      : '—';
  }

  estado(s: string | undefined): string {
    return s ? ESTADOS[s] ?? s : '—';
  }

  mapaUrl(e: MiEvidencia): string | null {
    const a = e.alerta;
    return a?.lat != null && a?.lng != null
      ? `https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lng}#map=17/${a.lat}/${a.lng}`
      : null;
  }

  private crearUrl(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.urlsCreadas.add(url);
    return url;
  }

  private mostrarAviso(texto: string): void {
    this.aviso.set(texto);
    setTimeout(() => {
      if (this.aviso() === texto) this.aviso.set('');
    }, 3500);
  }
}
