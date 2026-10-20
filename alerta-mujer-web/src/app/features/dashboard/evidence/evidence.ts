import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ParteGrabacion, ReproductorContinuoComponent } from '../../../shared/components/reproductor-continuo/reproductor-continuo';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import * as L from 'leaflet';
import {
  MiAlerta, MiEvidencia, MisEvidenciasService, TipoEvidencia,
} from '../../../core/services/mis-evidencias.service';
import { GeocodingService } from '../../../core/services/geocoding.service';

type Filtro = 'todas' | TipoEvidencia;

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
// Solo lo que sirve como evidencia de una emergencia (los documentos ya subidos se siguen viendo)
const ACEPTADOS = 'image/png,image/jpeg,image/webp,image/heic,video/*,audio/*';
const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
/** Días que se guardan las evidencias si la alerta no se marca para conservar (backend). */
export const DIAS_RETENCION = 60;
/** Máximo de alertas que se pueden conservar (backend: AlertService.MAX_ALERTAS_CONSERVADAS). */
export const MAX_CONSERVADAS = 5;

/** Alerta de la lista de la izquierda, con cuántas evidencias tiene. */
interface AlertaConEvidencias extends MiAlerta {
  cantidad: number;
}

@Component({
  selector: 'app-evidence',
  standalone: true,
  imports: [CommonModule, FormsModule, ReproductorContinuoComponent],
  templateUrl: './evidence.html',
  styleUrl: './evidence.scss',
})
export class Evidence implements OnInit, OnDestroy {
  private service = inject(MisEvidenciasService);
  private geocoding = inject(GeocodingService);
  private route = inject(ActivatedRoute);

  readonly tipos = TIPOS;
  readonly aceptados = ACEPTADOS;
  readonly maxMb = MAX_MB;
  readonly diasRetencion = DIAS_RETENCION;
  readonly maxConservadas = MAX_CONSERVADAS;

  evidencias = signal<MiEvidencia[]>([]);
  alertas = signal<MiAlerta[]>([]);
  cargando = signal(true);
  error = signal('');
  aviso = signal('');

  /** Alerta elegida en la lista: solo se muestran sus evidencias. */
  alertaId = signal<number | null>(null);
  buscarAlerta = signal('');
  soloConEvidencias = signal(true);
  filtro = signal<Filtro>('todas');
  /** Barrio y dirección de cada alerta (se resuelven al mostrarse). */
  direcciones = signal<Record<number, string>>({});

  // ── Visor ──────────────────────────────────────
  seleccionada = signal<MiEvidencia | null>(null);
  urlVisor = signal<string | null>(null);
  cargandoVisor = signal(false);
  errorVisor = signal('');
  private miniaturas = signal<Record<number, string>>({});
  /** Archivo ya descargado de cada evidencia (para no pedirlo dos veces). */
  private archivos: Record<number, string> = {};

  // ── Grabación completa (partes seguidas) ───────
  continua = signal<{ tipo: 'video' | 'audio'; partes: ParteGrabacion[] } | null>(null);
  cargandoContinua = signal(false);
  private urlsCreadas = new Set<string>();

  // ── Renombrar ──────────────────────────────────
  editandoNombre = signal(false);
  nuevoNombre = signal('');
  guardandoNombre = signal(false);

  // ── Mapa de la alerta ──────────────────────────
  mapaVisible = signal(false);
  @ViewChild('mapaAlerta') private mapaRef?: ElementRef<HTMLDivElement>;
  private mapa: L.Map | null = null;

  // ── Subida ─────────────────────────────────────
  subirVisible = signal(false);
  archivo = signal<File | null>(null);
  progreso = signal<number | null>(null);
  errorSubida = signal('');
  arrastrando = signal(false);

  /** Todas las alertas de la usuaria (más recientes primero) con su número de evidencias. */
  listaAlertas = computed<AlertaConEvidencias[]>(() => {
    const cantidad = new Map<number, number>();
    for (const e of this.evidencias()) cantidad.set(e.alertId, (cantidad.get(e.alertId) ?? 0) + 1);
    // Alertas con evidencias que no vinieron en la lista de alertas
    const conocidas = new Map<number, MiAlerta>(this.alertas().map((a) => [a.id, a]));
    for (const e of this.evidencias()) {
      if (!conocidas.has(e.alertId) && e.alerta) {
        conocidas.set(e.alertId, {
          id: e.alertId, estado: e.alerta.estado, metodo: e.alerta.metodo,
          inicio: e.alerta.inicio ?? e.fecha, lat: e.alerta.lat, lng: e.alerta.lng, conservar: false,
        });
      }
    }
    return [...conocidas.values()]
      .map((a) => ({ ...a, cantidad: cantidad.get(a.id) ?? 0 }))
      .sort((a, b) => b.inicio.getTime() - a.inicio.getTime());
  });

  alertasFiltradas = computed(() => {
    const termino = this.buscarAlerta().trim().toLowerCase();
    return this.listaAlertas().filter((a) => {
      if (this.soloConEvidencias() && a.cantidad === 0 && a.id !== this.alertaId()) return false;
      if (!termino) return true;
      return [this.fechaLarga(a.inicio), this.estado(a.estado), this.direcciones()[a.id] ?? '', `#${a.id}`]
        .some((t) => t.toLowerCase().includes(termino));
    });
  });

  alertaActual = computed(() => this.listaAlertas().find((a) => a.id === this.alertaId()) ?? null);

  private deLaAlerta = computed(() => this.evidencias().filter((e) => e.alertId === this.alertaId()));

  conteo = computed(() => {
    const c = { photo: 0, video: 0, audio: 0, document: 0 } as Record<TipoEvidencia, number>;
    for (const e of this.deLaAlerta()) c[e.tipo]++;
    return c;
  });

  /** Pestañas visibles: solo los tipos que tiene la alerta. */
  tiposVisibles = computed(() => (Object.keys(TIPOS) as TipoEvidencia[]).filter((t) => this.conteo()[t] > 0));

  filtradas = computed(() => {
    const filtro = this.filtro();
    return this.deLaAlerta()
      .filter((e) => filtro === 'todas' || e.tipo === filtro)
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  });

  ngOnInit(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    this.urlsCreadas.forEach((u) => URL.revokeObjectURL(u));
    this.mapa?.remove();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    // "Mis emergencias" abre este módulo con ?alertaId=ID
    const pedida = Number(this.route.snapshot.queryParamMap.get('alertaId')) || null;
    this.service.misAlertas().subscribe({
      next: (a) => {
        this.alertas.set(a);
        this.resolverDirecciones();
      },
      error: () => {},
    });
    this.service.listar().subscribe({
      next: (lista) => {
        this.evidencias.set(lista);
        this.cargando.set(false);
        const inicial = pedida ?? this.listaAlertas().find((a) => a.cantidad > 0)?.id ?? null;
        if (inicial) this.elegirAlerta(inicial);
      },
      error: () => {
        this.error.set('No se pudieron cargar tus evidencias. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  elegirAlerta(id: number): void {
    this.alertaId.set(id);
    this.continua.set(null);
    this.filtro.set('todas');
    this.cerrarEdicion();
    const primera = this.filtradas()[0];
    if (primera) this.ver(primera);
    else {
      this.seleccionada.set(null);
      this.urlVisor.set(null);
    }
    this.filtradas()
      .filter((e) => e.tipo === 'photo' && e.tieneArchivo)
      .forEach((e) => this.cargarMiniatura(e));
    this.resolverDirecciones();
  }

  /** Barrio y dirección de las alertas de la lista (OpenStreetMap, de a una por segundo). */
  resolverDirecciones(): void {
    for (const a of this.alertasFiltradas().slice(0, 15)) {
      if (a.lat == null || a.lng == null || this.direcciones()[a.id]) continue;
      this.geocoding.obtener(a.lat, a.lng).then((lugar) => {
        const texto = lugar ? [lugar.barrio, lugar.direccion].filter(Boolean).join(' · ') || lugar.ciudad : null;
        if (texto) this.direcciones.update((d) => ({ ...d, [a.id]: texto }));
      });
    }
  }

  miniatura(e: MiEvidencia): string | null {
    return this.miniaturas()[e.id] ?? null;
  }

  private cargarMiniatura(e: MiEvidencia): void {
    if (this.miniatura(e)) return;
    this.service.archivo(e.id).subscribe({
      next: (blob) => this.miniaturas.update((m) => ({ ...m, [e.id]: this.crearUrl(blob) })),
      error: () => {},
    });
  }

  /** Descarga todas las partes de un tipo y las muestra en el reproductor continuo. */
  verContinua(tipo: 'video' | 'audio'): void {
    const partes = this.deLaAlerta()
      .filter((e) => e.tipo === tipo && e.tieneArchivo)
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    if (partes.length === 0) return;
    this.seleccionada.set(null);
    this.cerrarEdicion();
    this.cargandoContinua.set(true);
    const alerta = this.alertaId();
    forkJoin(partes.map((e) => this.service.archivo(e.id))).subscribe({
      next: (blobs) => {
        if (this.alertaId() !== alerta) return;
        this.continua.set({
          tipo,
          partes: partes.map((e, i) => {
            this.archivos[e.id] ??= this.crearUrl(blobs[i]);
            return { id: e.id, url: this.archivos[e.id], creada: e.fecha };
          }),
        });
        this.cargandoContinua.set(false);
      },
      error: () => {
        this.cargandoContinua.set(false);
        this.mostrarAviso('No se pudieron cargar todas las partes de la grabación.');
      },
    });
  }

  // ── Visor ──────────────────────────────────────
  ver(e: MiEvidencia): void {
    this.continua.set(null);
    this.seleccionada.set(e);
    this.cerrarEdicion();
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
        this.evidencias.set(this.evidencias().filter((x) => x.id !== e.id));
        if (this.seleccionada()?.id === e.id) {
          this.seleccionada.set(null);
          this.urlVisor.set(null);
          const siguiente = this.filtradas()[0];
          if (siguiente) this.ver(siguiente);
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

  // ── Conservar ──────────────────────────────────
  guardandoConservar = signal(false);
  totalConservadas = computed(() => this.listaAlertas().filter((a) => a.conservar).length);

  /** Fecha en que se borrará la evidencia (si su alerta no está marcada para conservar). */
  fechaBorrado(e: MiEvidencia): Date {
    return new Date(e.fecha.getTime() + DIAS_RETENCION * 24 * 60 * 60 * 1000);
  }

  cambiarConservar(alerta: AlertaConEvidencias): void {
    if (this.guardandoConservar()) return;
    const conservar = !alerta.conservar;
    this.guardandoConservar.set(true);
    this.service.conservar(alerta.id, conservar).subscribe({
      next: () => {
        this.alertas.update((l) => l.map((a) => (a.id === alerta.id ? { ...a, conservar } : a)));
        this.guardandoConservar.set(false);
        this.mostrarAviso(conservar
          ? 'Las evidencias de esta alerta se conservarán hasta que tú las borres.'
          : `Las evidencias de esta alerta se borrarán a los ${DIAS_RETENCION} días.`);
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoConservar.set(false);
        this.mostrarAviso(err.error?.message ?? 'No se pudo cambiar. Intenta de nuevo.');
      },
    });
  }

  // ── Renombrar ──────────────────────────────────
  /** Se edita el nombre sin la extensión; el servidor se la vuelve a poner. */
  editarNombre(e: MiEvidencia): void {
    this.nuevoNombre.set(e.nombreArchivo.replace(/\.[a-z0-9]{1,5}$/i, ''));
    this.editandoNombre.set(true);
  }

  cerrarEdicion(): void {
    this.editandoNombre.set(false);
    this.guardandoNombre.set(false);
  }

  guardarNombre(e: MiEvidencia): void {
    const nombre = this.nuevoNombre().trim();
    if (!nombre || this.guardandoNombre()) return;
    this.guardandoNombre.set(true);
    this.service.renombrar(e.id, nombre).subscribe({
      next: (actualizada) => {
        this.evidencias.update((l) => l.map((x) => (x.id === e.id ? { ...x, nombreArchivo: actualizada.nombreArchivo } : x)));
        this.seleccionada.set({ ...e, nombreArchivo: actualizada.nombreArchivo });
        this.cerrarEdicion();
        this.mostrarAviso('Nombre actualizado.');
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoNombre.set(false);
        this.mostrarAviso(err.error?.message ?? 'No se pudo cambiar el nombre.');
      },
    });
  }

  // ── Mapa de la alerta (dentro de la app, con zoom) ─────
  abrirMapa(): void {
    const a = this.alertaActual();
    if (a?.lat == null || a?.lng == null) return;
    const centro: L.LatLngTuple = [a.lat, a.lng];
    this.mapaVisible.set(true);
    setTimeout(() => {
      if (!this.mapaRef) return;
      this.mapa?.remove();
      this.mapa = L.map(this.mapaRef.nativeElement, { center: centro, zoom: 17 });
      L.tileLayer(TILES, { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(this.mapa);
      L.circleMarker(centro, { radius: 10, color: '#fff', weight: 3, fillColor: '#7c3aed', fillOpacity: 1 })
        .addTo(this.mapa)
        .bindPopup(this.direcciones()[a.id] ?? 'Lugar de la alerta')
        .openPopup();
    }, 50);
  }

  cerrarMapa(): void {
    this.mapaVisible.set(false);
    this.mapa?.remove();
    this.mapa = null;
  }

  // ── Subida ─────────────────────────────────────
  abrirSubida(): void {
    this.subirVisible.set(true);
    this.archivo.set(null);
    this.errorSubida.set('');
    this.progreso.set(null);
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
    if (!/^(image\/(png|jpeg|webp|heic)|video\/|audio\/)/.test(f.type)) {
      this.errorSubida.set('Solo se permiten fotos, videos o audios.');
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
    const alertId = this.alertaId();
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

  hora(d: Date | null): string {
    return d ? d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '';
  }

  estado(s: string | undefined): string {
    return s ? ESTADOS[s] ?? s : '—';
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
