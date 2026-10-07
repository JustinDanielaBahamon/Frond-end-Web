import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { AlertsService } from '../../../core/services/alerts.services';
import { EmergencyContactService } from '../../../core/services/emergency-contact.service';
import { EvidenceService } from '../../../core/services/evidence.service';
import { DeviceService } from '../../../core/services/device.service';
import { PhoneLocationService } from '../../../core/services/phone.location.services';
import { Alerta } from '../../../core/models/alert.model';
import { ContactoEmergencia } from '../../../core/models/emergency-contact.model';
import { Evidencia } from '../../../core/models/evidence.model';
import { UbicacionEntry } from '../../../core/models/location.model';

interface SeguridadItem {
  icon: string;
  valor: string;
  descripcion: string;
  configurado: boolean;
}

interface MiDispositivo {
  estado: string;
  ultimaComunicacion: string;
  ultimaUbicacion: string;
}

interface ActividadItem {
  icon: string;
  color: 'peligro' | 'exito' | 'principal';
  titulo: string;
  detalle?: string; // ubicación o dato real adicional, cuando exista
  fecha: string;
}

interface UltimaEmergencia {
  fecha: string;
  hora: string;
  ubicacion: string;
  activadaMediante: string;
  contactosNotificados: string; // el backend no expone el resultado de notificación
  estado: string;
}

interface UltimaUbicacion {
  lat: number;
  lng: number;
  direccion: string;
  fecha: string;
}

interface AccesoRapido {
  icon: string;
  color: 'peligro' | 'exito' | 'principal' | 'acento' | 'advertencia';
  label: string;
  sub: string;
  route: string;
}

interface AccionRapida {
  icon: string;
  label: string;
  route: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NgClass, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit, OnDestroy {

  private map: L.Map | null = null;
  private authService = inject(AuthService);
  private alertsService = inject(AlertsService);
  private contactsService = inject(EmergencyContactService);
  private evidenceService = inject(EvidenceService);
  private deviceService = inject(DeviceService);
  private phoneLocationService = inject(PhoneLocationService);

  // ── ESTADO DE SEGURIDAD ───────────────────────────
  // Valores neutros hasta que lleguen los datos reales.
  estadoSeguridad: SeguridadItem[] = [
    { icon: 'ti-users',        valor: '0',            descripcion: 'Contactos de emergencia', configurado: false },
    { icon: 'ti-shield-check', valor: 'Sin configurar', descripcion: 'Método de activación',  configurado: false },
    { icon: 'ti-map-pin',      valor: 'Sin ubicación', descripcion: 'Ubicación activa',       configurado: false },
    { icon: 'ti-bell',         valor: 'No disponible', descripcion: 'Notificaciones',          configurado: false },
    { icon: 'ti-folder',       valor: '0',            descripcion: 'Evidencias almacenadas',  configurado: false },
  ];

  // Estado general: depende de los indicadores reales de arriba.
  estadoGeneralSeguridad = 'Cargando tu información…';

  // ── MI DISPOSITIVO ────────────────────────────────
  miDispositivo: MiDispositivo = {
    estado: 'Sin datos',
    ultimaComunicacion: 'Sin comunicación registrada',
    ultimaUbicacion: 'Sin ubicación registrada',
  };

  // ── ACTIVIDAD RECIENTE ────────────────────────────
  actividadReciente: ActividadItem[] = [];

  // ── ÚLTIMA EMERGENCIA ─────────────────────────────
  ultimaEmergencia: UltimaEmergencia = {
    fecha: '',
    hora: '',
    ubicacion: '',
    activadaMediante: '',
    contactosNotificados: 'No disponible',
    estado: '',
  };
  tieneUltimaEmergencia = false;

  // ── ÚLTIMA UBICACIÓN REGISTRADA ───────────────────
  ultimaUbicacion: UltimaUbicacion = {
    lat: 0,
    lng: 0,
    direccion: '',
    fecha: '',
  };
  ultimaUbicacionDisponible = false;

  // ── ACCESOS RÁPIDOS ───────────────────────────────
  accesosRapidos: AccesoRapido[] = [
    { icon: 'ti-alert-triangle', color: 'peligro',     label: 'Mis emergencias', sub: 'Ver historial',    route: '/dashboard/alert-history' },
    { icon: 'ti-folder',         color: 'exito',       label: 'Evidencias',      sub: 'Ver mis archivos', route: '/dashboard/evidence' },
    { icon: 'ti-users',          color: 'principal',   label: 'Contactos',       sub: 'Gestionar',        route: '/dashboard/emergency-contacts' },
    { icon: 'ti-map-pin',        color: 'acento',      label: 'Ubicación',       sub: 'Ver mapa',         route: '/dashboard/ubicacion' },
    { icon: 'ti-phone',          color: 'advertencia', label: 'Asistencia',      sub: 'Recursos y ayuda', route: '/dashboard/assistance' },
  ];

  // ── ACCIONES RÁPIDAS ──────────────────────────────
  accionesRapidas: AccionRapida[] = [
    { icon: 'ti-file-text', label: 'Generar informe de emergencia',   route: '/dashboard/informe', disabled: true },
    { icon: 'ti-book',      label: 'Ver tutorial nuevamente',          route: '/dashboard/tutorial', disabled: true },
    { icon: 'ti-user',      label: 'Actualizar información personal',  route: '/dashboard/settings' },
  ];

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((usuario) => {
      if (!usuario) return;
      this.cargarDashboard(usuario.id);
    });
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  /** Carga todas las fuentes reales. Cada sección se defiende sola:
   *  si un endpoint falla, esa sección queda vacía y no se bloquea el resto. */
  private cargarDashboard(usuarioId: number): void {
    forkJoin([
      this.seguro(this.contactsService.getByUsuario(usuarioId)),
      this.seguro(this.alertsService.getByUsuario(usuarioId)),
      this.seguro(this.evidenceService.getAll()),
      this.seguro(this.deviceService.getAll()),
      this.seguro(this.phoneLocationService.getByUsuario(usuarioId)),
    ]).subscribe({
      next: ([contactos, alertas, evidencias, devices, ubicaciones]) => {
        // El backend no filtra evidencias por usuaria: la evidencia se asocia
        // a una alerta, así que se quedan solo las de las alertas de esta usuaria.
        const misAlertas = alertas as Alerta[];
        const misEvidencias = this.filtrarEvidenciasPropias(evidencias as any[], misAlertas);

        this.procesarContactos(contactos as ContactoEmergencia[], misEvidencias);
        this.procesarAlertas(misAlertas);
        this.procesarDispositivo(devices as any[], usuarioId, ubicaciones as UbicacionEntry[]);
        this.procesarUbicaciones(ubicaciones as UbicacionEntry[]);
        this.procesarActividad(misAlertas, contactos as ContactoEmergencia[], misEvidencias as any[]);
        this.actualizarEstadoGeneral();
      },
      error: () => {
        this.estadoGeneralSeguridad = 'No fue posible cargar la información. Intenta de nuevo.';
      },
    });
  }

  /** Evita que un endpoint caído deje el dashboard entero en error. */
  private seguro<T>(obs: Observable<T[]>): Observable<T[]> {
    return obs.pipe(catchError(() => of([])));
  }

  private filtrarEvidenciasPropias(evidencias: any[], alertas: Alerta[]): any[] {
    const idsAlertas = new Set(alertas.map((a) => a.id));
    return evidencias.filter((e) => idsAlertas.has(Number(e.alertId ?? e.alertaId)));
  }

  // ── PROCESAMIENTO ─────────────────────────────────

  private procesarContactos(contactos: ContactoEmergencia[], evidencias: any[]): void {
    const activos = contactos.filter((c) => c.activo !== false);
    this.estadoSeguridad = this.estadoSeguridad.map((s) => {
      if (s.descripcion === 'Contactos de emergencia') {
        return { ...s, valor: String(activos.length), configurado: activos.length > 0 };
      }
      if (s.descripcion === 'Evidencias almacenadas') {
        return { ...s, valor: String(evidencias.length), configurado: evidencias.length > 0 };
      }
      return s;
    });
  }

  private procesarAlertas(alertas: Alerta[]): void {
    if (!alertas.length) {
      this.tieneUltimaEmergencia = false;
      this.ultimaEmergencia = {
        fecha: '',
        hora: '',
        ubicacion: '',
        activadaMediante: '',
        contactosNotificados: 'No disponible',
        estado: '',
      };
      return;
    }

    const ordenadas = [...alertas].sort((a, b) =>
      this.fechaValor(b.started_at ?? b.created_at) - this.fechaValor(a.started_at ?? a.created_at),
    );
    const ultima = ordenadas[0];
    const instante = this.fechaValor(ultima.started_at ?? ultima.created_at);

    this.tieneUltimaEmergencia = true;
    this.ultimaEmergencia = {
      fecha: this.formatearFecha(instante),
      hora: this.formatearHora(instante),
      ubicacion: this.ubicacionReal(ultima),
      activadaMediante: ultima.medioActivacion || 'Sin configurar',
      contactosNotificados: 'No disponible',
      estado: ultima.estado,
    };

    // Método de activación real, tomado de la última alerta registrada.
    // Solo queda como configurado si la alerta trae un medio de activación.
    this.estadoSeguridad = this.estadoSeguridad.map((s) =>
      s.descripcion === 'Método de activación'
        ? { ...s, valor: ultima.medioActivacion || 'Sin configurar', configurado: !!ultima.medioActivacion }
        : s,
    );
  }

  /** Actividad real: alertas, evidencias y contactos, del más reciente al más antiguo. */
  private procesarActividad(alertas: Alerta[], contactos: ContactoEmergencia[], evidencias: any[]): void {
    type Evento = { item: ActividadItem; instante: number };
    const eventos: Evento[] = [];

    for (const a of alertas) {
      const instante = this.fechaValor(a.started_at ?? a.created_at);
      eventos.push({
        item: {
          icon: 'ti-alert-octagon',
          color: 'peligro',
          titulo: `Alerta de emergencia • ${a.estado}`,
          detalle: a.lat && a.lng ? this.ubicacionReal(a) : undefined,
          fecha: this.haceCuanto(a.started_at ?? a.created_at),
        },
        instante,
      });
    }

    for (const e of evidencias) {
      const instante = this.fechaValor(e.createdAt ?? e.created_at ?? e.fecha);
      eventos.push({
        item: {
          icon: 'ti-folder',
          color: 'principal',
          titulo: `Evidencia subida • ${e.mediaType ?? e.tipo ?? 'archivo'}`,
          fecha: this.haceCuanto(e.createdAt ?? e.created_at ?? e.fecha),
        },
        instante,
      });
    }

    for (const c of contactos) {
      const instante = this.fechaValor(c.creadoEn);
      eventos.push({
        item: {
          icon: 'ti-user-plus',
          color: 'exito',
          titulo: `Contacto agregado • ${c.nombre}`,
          fecha: this.haceCuanto(c.creadoEn),
        },
        instante,
      });
    }

    this.actividadReciente = eventos
      .filter((ev) => !isNaN(ev.instante))
      .sort((x, y) => y.instante - x.instante)
      .slice(0, 5)
      .map((ev) => ev.item);
  }

  private procesarDispositivo(devices: any[], usuarioId: number, ubicaciones: UbicacionEntry[]): void {
    const miDevice = devices.find((d) => Number(d.accountId) === Number(usuarioId));

    // Notificaciones: sin dispositivo registrado no hay medio
    // para recibir alertas; con dispositivo, la vía está configurada.
    this.estadoSeguridad = this.estadoSeguridad.map((s) =>
      s.descripcion === 'Notificaciones'
        ? { ...s, valor: miDevice ? 'Dispositivo registrado' : 'Sin dispositivo', configurado: !!miDevice }
        : s,
    );

    if (!miDevice) {
      this.miDispositivo = {
        estado: 'Sin dispositivo registrado',
        ultimaComunicacion: 'Sin comunicación registrada',
        ultimaUbicacion: 'Sin ubicación registrada',
      };
      return;
    }
    const ultimaUbicacion = this.ultimaUbicacionOrdenada(ubicaciones);
    this.miDispositivo = {
      estado: this.estadoDispositivo(miDevice.lastAccess),
      ultimaComunicacion: miDevice.lastAccess
        ? this.formatearFechaHora(miDevice.lastAccess)
        : 'Sin comunicación registrada',
      ultimaUbicacion: ultimaUbicacion
        ? `${ultimaUbicacion.lat.toFixed(6)}, ${ultimaUbicacion.lng.toFixed(6)}`
        : 'Sin ubicación registrada',
    };
  }

  private procesarUbicaciones(ubicaciones: UbicacionEntry[]): void {
    const ultima = this.ultimaUbicacionOrdenada(ubicaciones);
    const disponible = !!ultima && !(ultima.lat === 0 && ultima.lng === 0);

    this.ultimaUbicacionDisponible = disponible;
    if (!disponible || !ultima) {
      this.ultimaUbicacion = { lat: 0, lng: 0, direccion: '', fecha: '' };
    } else {
      this.ultimaUbicacion = {
        lat: ultima.lat,
        lng: ultima.lng,
        // El backend no guarda dirección: se muestran las coordenadas reales.
        direccion: `${ultima.lat.toFixed(6)}, ${ultima.lng.toFixed(6)}`,
        fecha: this.formatearFechaHora(ultima.recordedAt ?? `${ultima.date ?? ''}T${ultima.time ?? ''}`),
      };
    }

    this.estadoSeguridad = this.estadoSeguridad.map((s) =>
      s.descripcion === 'Ubicación activa'
        ? { ...s, valor: disponible ? 'Ubicación reciente' : 'Sin ubicación', configurado: disponible }
        : s,
    );

    this.actualizarMiniMapa();
  }

  private actualizarEstadoGeneral(): void {
    const faltantes = this.estadoSeguridad
      .filter((s) => !s.configurado)
      .map((s) => s.descripcion.toLowerCase());
    this.estadoGeneralSeguridad = faltantes.length === 0
      ? 'Tu cuenta está protegida'
      : `Falta configurar: ${faltantes.join(', ')}`;
  }

  // ── HELPERS ───────────────────────────────────────

  private ultimaUbicacionOrdenada(ubicaciones: UbicacionEntry[]): UbicacionEntry | null {
    const validas = ubicaciones.filter((u) => u.lat != null && u.lng != null);
    if (!validas.length) return null;
    return [...validas]
      .sort((a, b) =>
        this.fechaValor(b.recordedAt ?? `${b.date ?? ''}T${b.time ?? ''}`)
        - this.fechaValor(a.recordedAt ?? `${a.date ?? ''}T${a.time ?? ''}`),
      )[0];
  }

  /** "Conectado" solo si hubo comunicación en los últimos 15 minutos. */
  private estadoDispositivo(lastAccess?: string | null): string {
    const instante = this.fechaValor(lastAccess);
    if (isNaN(instante)) return 'Sin comunicación registrada';
    return Date.now() - instante <= 15 * 60 * 1000 ? 'Conectado' : 'Sin conexión';
  }

  private ubicacionReal(a: Alerta): string {
    if (a.lat && a.lng) return `${a.lat.toFixed(6)}, ${a.lng.toFixed(6)}`;
    return 'No se registró ubicación';
  }

  /** El backend manda LocalDateTime sin zona: se interpreta como hora de Colombia. */
  private fechaValor(raw?: string | null): number {
    if (!raw) return NaN;
    const iso = raw.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw}Z`;
    const t = new Date(iso).getTime();
    return isNaN(t) ? NaN : t;
  }

  private formatearFecha(instante: number): string {
    if (isNaN(instante)) return '';
    return new Date(instante).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Bogota',
    });
  }

  private formatearHora(instante: number): string {
    if (isNaN(instante)) return '';
    return new Date(instante).toLocaleTimeString('es-CO', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Bogota',
    });
  }

  private formatearFechaHora(raw?: string | null): string {
    const instante = this.fechaValor(raw);
    if (isNaN(instante)) return '';
    return `${this.formatearFecha(instante)}, ${this.formatearHora(instante)}`;
  }

  private haceCuanto(raw?: string | null): string {
    const instante = this.fechaValor(raw);
    if (isNaN(instante)) return '';
    const min = Math.round((Date.now() - instante) / 60000);
    if (min < 1) return 'Ahora';
    if (min < 60) return `Hace ${min} min`;
    if (min < 1440) return `Hace ${Math.round(min / 60)} h`;
    return `Hace ${Math.round(min / 1440)} d`;
  }

  // ── MINI-MAPA ─────────────────────────────────────
  /** Solo se crea cuando hay coordenadas reales; nunca se muestra un mapa
   *  con coordenadas inventadas. */
  private actualizarMiniMapa(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    if (!this.ultimaUbicacionDisponible) return;

    setTimeout(() => {
      if (this.map || !this.ultimaUbicacionDisponible) return;
      const contenedor = document.getElementById('home-mini-map');
      if (!contenedor) return;

      this.map = L.map(contenedor, {
        center: [this.ultimaUbicacion.lat, this.ultimaUbicacion.lng],
        zoom: 15,
        zoomControl: false,
        scrollWheelZoom: false,
        dragging: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      }).addTo(this.map);

      const icono = L.divIcon({
        className: '',
        html: `<div class="home-mini-map__pin"><i class="ti ti-map-pin-filled"></i></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      L.marker([this.ultimaUbicacion.lat, this.ultimaUbicacion.lng], { icon: icono }).addTo(this.map);
    }, 60);
  }
}
