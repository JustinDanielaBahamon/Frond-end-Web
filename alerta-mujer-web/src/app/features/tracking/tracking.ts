import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { ReproductorContinuoComponent } from '../../shared/components/reproductor-continuo/reproductor-continuo';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';
import { MensajeAlerta, Seguimiento, TrackingService } from '../../core/services/tracking.service';
import { GeocodingService, Lugar } from '../../core/services/geocoding.service';

const REFRESCO_MS = 10000;

const CHAT_REFRESCO_MS = 5000;
const CLAVE_NOMBRE = 'alerta-mujer-nombre-contacto';

/** Respuestas rápidas del contacto (un toque, como los mensajes rápidos de la app). */
export const RESPUESTAS_RAPIDAS = [
  'Voy en camino',
  'Ya llamé a la policía',
  '¿Dónde estás?',
  '¿Estás bien?',
  'Mantén la calma, ya vamos',
];

const COLOR_INICIO = '#7c3aed';
const COLOR_ACTUAL = '#d946ef';

/** Distancia en km entre dos puntos (Haversine). */
function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const duracionTexto = (ms: number): string => {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 1) return 'menos de 1 min';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
};

/**
 * Pantalla pública que abre un contacto de emergencia desde el correo: estado de la alerta, mapa
 * con el recorrido, dirección de la última ubicación, evidencias grabadas, qué hacer y accesos
 * rápidos para llamar o llegar al lugar.
 */
@Component({
  selector: 'app-tracking',
  standalone: true,
  imports: [CommonModule, ReproductorContinuoComponent],
  templateUrl: './tracking.html',
  styleUrl: './tracking.scss',
})
export class TrackingComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  /**
   * true si se llegó desde "Alertas de mis contactos" del panel con sesión iniciada: solo entonces
   * se ofrece volver. Desde el enlace del correo no hay a dónde volver.
   */
  readonly desdePanel = typeof history !== 'undefined' && history.state?.desdePanel === true;

  volverAlPanel(): void {
    this.router.navigate(['/dashboard/alertas-contactos']);
  }
  private trackingService = inject(TrackingService);
  private geocoding = inject(GeocodingService);
  private destroyRef = inject(DestroyRef);

  readonly datos = signal<Seguimiento | null>(null);
  readonly error = signal('');
  readonly cargando = signal(true);
  readonly despertando = signal(false);
  readonly ahora = signal(Date.now());

  readonly ultimo = computed(() => {
    const r = this.datos()?.recorrido ?? [];
    return r.length ? r[r.length - 1] : null;
  });

  readonly haceCuanto = computed(() => {
    const u = this.ultimo();
    if (!u) return '';
    const min = Math.max(0, Math.round((this.ahora() - u.hora.getTime()) / 60000));
    return min === 0 ? 'hace menos de un minuto' : min === 1 ? 'hace 1 minuto' : `hace ${min} minutos`;
  });

  readonly mapsUrl = computed(() => {
    const u = this.ultimo();
    return u ? `https://www.google.com/maps/search/?api=1&query=${u.lat},${u.lng}` : '';
  });
  /** Ruta en Google Maps desde donde está el contacto hasta la última ubicación. */
  readonly comoLlegarUrl = computed(() => {
    const u = this.ultimo();
    return u ? `https://www.google.com/maps/dir/?api=1&destination=${u.lat},${u.lng}` : '';
  });
  /** Dirección y barrio de la última ubicación (OpenStreetMap). */
  readonly lugar = signal<Lugar | null>(null);
  readonly zona = computed(() => [this.lugar()?.barrio, this.lugar()?.ciudad].filter(Boolean).join(', '));
  readonly duracion = computed(() => {
    const d = this.datos();
    if (!d?.inicio) return '';
    const fin = d.fin ?? new Date(this.ahora());
    return duracionTexto(fin.getTime() - d.inicio.getTime());
  });
  readonly recorridoKm = computed(() => {
    const r = this.datos()?.recorrido ?? [];
    let total = 0;
    for (let i = 1; i < r.length; i++) total += distanciaKm(r[i - 1], r[i]);
    return total;
  });
  /** Recorrido para la línea de tiempo: del más reciente al primero (máx. 20). */
  readonly recorridoLista = computed(() => {
    const r = this.datos()?.recorrido ?? [];
    return r
      .map((p, i) => ({ ...p, numero: i + 1, esActual: i === r.length - 1 }))
      .reverse()
      .slice(0, 20);
  });
  /** Barrio y dirección de cada punto ("lat,lng" redondeado -> texto). */
  readonly lugaresPuntos = signal<Record<string, string>>({});
  readonly videos = computed(() => (this.datos()?.evidencias ?? []).filter((e) => e.tipo === 'video'));
  readonly audios = computed(() => (this.datos()?.evidencias ?? []).filter((e) => e.tipo === 'audio'));
  private claveLugar = '';

  // ── Chat de la alerta ──
  readonly respuestasRapidas = RESPUESTAS_RAPIDAS;
  readonly mensajes = signal<MensajeAlerta[]>([]);
  readonly nombreContacto = signal(this.leerNombre());
  readonly borradorNombre = signal('');
  readonly textoMensaje = signal('');
  readonly enviando = signal(false);
  readonly errorChat = signal('');
  private chatTemporizador: ReturnType<typeof setInterval> | null = null;

  private codigo = '';
  private mapa: L.Map | null = null;
  private capa: L.LayerGroup | null = null;
  private temporizador: ReturnType<typeof setInterval> | null = null;
  private primeraVista = true;

  ngOnInit(): void {
    this.codigo = this.route.snapshot.paramMap.get('codigo') ?? '';
    // Si el servidor (Render gratis) estaba dormido, la primera respuesta puede tardar
    const aviso = setTimeout(() => this.despertando.set(true), 4000);
    this.consultar(() => clearTimeout(aviso));
    this.destroyRef.onDestroy(() => {
      if (this.temporizador) clearInterval(this.temporizador);
      if (this.chatTemporizador) clearInterval(this.chatTemporizador);
      this.mapa?.remove();
    });
  }

  private consultar(alTerminar?: () => void): void {
    this.trackingService.consultar(this.codigo).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => {
        alTerminar?.();
        this.datos.set(d);
        this.error.set('');
        this.cargando.set(false);
        this.despertando.set(false);
        this.ahora.set(Date.now());
        setTimeout(() => this.pintarMapa(d));
        this.buscarLugar();
        this.buscarLugaresPuntos();
        this.actualizarChat(d.activa);
        if (d.activa && !this.temporizador) {
          this.temporizador = setInterval(() => this.consultar(), REFRESCO_MS);
        } else if (!d.activa && this.temporizador) {
          clearInterval(this.temporizador);
          this.temporizador = null;
        }
      },
      error: (err) => {
        alTerminar?.();
        this.cargando.set(false);
        this.despertando.set(false);
        if (err?.status === 404) {
          this.error.set('Este enlace no existe o ya venció. Los enlaces dejan de funcionar 2 horas después de que termina la alerta.');
          if (this.temporizador) clearInterval(this.temporizador);
          this.temporizador = null;
        } else if (!this.datos()) {
          this.error.set('No se pudo conectar con AlertaMujer. Revisa tu conexión e inténtalo de nuevo.');
        }
        // Con datos ya mostrados, un fallo puntual no borra la pantalla: el siguiente intento la actualiza
      },
    });
  }

  static claveDe(p: { lat: number; lng: number }): string {
    return `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
  }

  /** Para la plantilla. */
  claveDe(p: { lat: number; lng: number }): string {
    return TrackingComponent.claveDe(p);
  }

  /** Dirección de los puntos más recientes (OpenStreetMap: una consulta por segundo, en caché). */
  private buscarLugaresPuntos(): void {
    for (const p of this.recorridoLista().slice(0, 8)) {
      const clave = TrackingComponent.claveDe(p);
      if (this.lugaresPuntos()[clave] !== undefined) continue;
      this.lugaresPuntos.update((l) => ({ ...l, [clave]: '' }));
      this.geocoding.obtener(p.lat, p.lng).then((lugar) => {
        const texto = [lugar?.direccion, lugar?.barrio].filter(Boolean).join(' · ');
        this.lugaresPuntos.update((l) => ({ ...l, [clave]: texto }));
      });
    }
  }

  /** Busca la dirección solo cuando la última ubicación cambió (~11 m). */
  private buscarLugar(): void {
    const u = this.ultimo();
    if (!u) return;
    const clave = `${u.lat.toFixed(4)},${u.lng.toFixed(4)}`;
    if (clave === this.claveLugar) return;
    this.claveLugar = clave;
    this.geocoding.obtener(u.lat, u.lng).then((l) => {
      if (clave === this.claveLugar) this.lugar.set(l);
    });
  }

  /** Lleva el mapa a la posición actual de la persona, con zoom de calle. */
  centrarEnPersona(): void {
    const u = this.ultimo();
    if (u && this.mapa) this.mapa.flyTo([u.lat, u.lng], 17, { duration: 0.8 });
  }

  /** Vuelve a encuadrar todo el recorrido. */
  centrar(): void {
    const d = this.datos();
    if (d) this.encuadrar(d);
  }

  private encuadrar(d: Seguimiento): void {
    if (!this.mapa || !d.recorrido.length) return;
    const puntos = d.recorrido.map((p) => L.latLng(p.lat, p.lng));
    if (puntos.length === 1) this.mapa.setView(puntos[0], 16);
    else this.mapa.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 17 });
  }

  // Mensajes nuevos cada 5 s mientras la alerta está activa (al terminar, una última lectura)
  private actualizarChat(activa: boolean): void {
    this.leerMensajesNuevos();
    if (activa && !this.chatTemporizador) {
      this.chatTemporizador = setInterval(() => this.leerMensajesNuevos(), CHAT_REFRESCO_MS);
    } else if (!activa && this.chatTemporizador) {
      clearInterval(this.chatTemporizador);
      this.chatTemporizador = null;
    }
  }

  private leerMensajesNuevos(): void {
    const ultimo = this.mensajes().at(-1)?.id ?? 0;
    this.trackingService.mensajes(this.codigo, ultimo).subscribe({
      next: (nuevos) => {
        if (nuevos.length) this.agregarMensajes(nuevos);
      },
      error: () => {
        // Un fallo puntual no borra el chat: se reintenta en la siguiente lectura
      },
    });
  }

  private agregarMensajes(nuevos: MensajeAlerta[]): void {
    const ids = new Set(this.mensajes().map((m) => m.id));
    this.mensajes.update((actuales) => [...actuales, ...nuevos.filter((m) => !ids.has(m.id))]);
    setTimeout(() => document.getElementById('chat-lista')?.scrollTo({ top: 1e6, behavior: 'smooth' }));
  }

  guardarNombre(): void {
    const nombre = this.borradorNombre().trim().slice(0, 60);
    if (!nombre) return;
    this.nombreContacto.set(nombre);
    try {
      localStorage.setItem(CLAVE_NOMBRE, nombre);
    } catch {
      // modo privado: se pedirá de nuevo la próxima vez
    }
  }

  enviar(texto: string): void {
    const cuerpo = texto.trim();
    if (!cuerpo || this.enviando() || !this.nombreContacto()) return;
    this.enviando.set(true);
    this.errorChat.set('');
    this.trackingService.enviarMensaje(this.codigo, this.nombreContacto(), cuerpo).subscribe({
      next: (m) => {
        this.agregarMensajes([m]);
        this.textoMensaje.set('');
        this.enviando.set(false);
      },
      error: (e) => {
        this.enviando.set(false);
        this.errorChat.set(e?.error?.message || 'No se pudo enviar el mensaje. Intenta de nuevo.');
      },
    });
  }

  private leerNombre(): string {
    try {
      return localStorage.getItem(CLAVE_NOMBRE) ?? '';
    } catch {
      return '';
    }
  }

  reintentar(): void {
    this.error.set('');
    this.cargando.set(true);
    this.consultar();
  }

  private pintarMapa(d: Seguimiento): void {
    const contenedor = document.getElementById('mapa-seguimiento');
    if (!contenedor || !d.recorrido.length) return;
    if (!this.mapa) {
      this.mapa = L.map(contenedor, { zoomControl: true, attributionControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(this.mapa);
      this.capa = L.layerGroup().addTo(this.mapa);
    }
    this.capa!.clearLayers();
    const puntos = d.recorrido.map((p) => L.latLng(p.lat, p.lng));
    // Igual que en la app: línea punteada y un pin numerado por cada ubicación enviada
    if (puntos.length > 1) {
      L.polyline(puntos, { color: COLOR_INICIO, weight: 3, opacity: 0.85, dashArray: '6 8', lineCap: 'round' }).addTo(this.capa!);
    }
    const u = puntos[puntos.length - 1];
    const precision = d.recorrido[d.recorrido.length - 1].precision;
    if (precision && precision > 0) {
      L.circle(u, { radius: precision, color: COLOR_ACTUAL, weight: 1, fillOpacity: 0.12 }).addTo(this.capa!);
    }
    d.recorrido.forEach((p, i) => {
      const esUltimo = i === d.recorrido.length - 1;
      const icono = L.divIcon({
        className: '',
        html: `<span class="pin-ruta${esUltimo ? ' pin-ruta--actual' : i === 0 ? ' pin-ruta--inicio' : ''}">${i + 1}</span>`,
        iconSize: esUltimo ? [34, 34] : [24, 24],
        iconAnchor: esUltimo ? [17, 17] : [12, 12],
      });
      const hora = p.hora.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
      L.marker([p.lat, p.lng], { icon: icono, zIndexOffset: esUltimo ? 1000 : i })
        .bindTooltip(`${esUltimo ? 'Última ubicación' : i === 0 ? 'Inicio' : `Punto ${i + 1}`} · ${hora}`)
        .addTo(this.capa!);
    });
    // La primera vez se ve todo el recorrido; después solo se sigue la posición actual
    if (this.primeraVista) {
      this.encuadrar(d);
      this.primeraVista = false;
    } else {
      this.mapa.panTo(u);
    }
    this.mapa.invalidateSize();
  }
}
