import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';

interface Ubicacion {
  lat: number;
  lng: number;
  direccion: string;
}

interface AlertaActiva {
  id: string;
  usuarioId: number;
  estado: 'active' | 'inactive' | 'resolved';
  tipo: string;
  mensaje: string;
  ubicacion: Ubicacion;
  dispositivoOrigen: 'web' | 'android';
  sincronizado: boolean;
  contactosNotificados: number[];
  started_at: string | null;
  ended_at: string | null;
}

interface Dispositivo {
  id: string;
  usuarioId: number;
  tipo: 'web' | 'android';
  nombre: string;
  activo: boolean;
  ultimaConexion: string;
  ubicacion: { lat: number; lng: number };
}

interface ContactoEmergencia {
  id: string;
  usuarioId: number;
  nombre: string;
  telefono: string;
  email: string;
  relacion: string;
  notificado: boolean;
  ultimaNotificacion: string | null;
}

@Injectable({ providedIn: 'root' })
export class AlertService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // Estado local de la alerta activa
  private alertaActivaSubject = new BehaviorSubject<AlertaActiva | null>(null);
  alertaActiva$ = this.alertaActivaSubject.asObservable();

  // Estado de sincronización
  private sincronizacionSubject = new BehaviorSubject<boolean>(true);
  sincronizacion$ = this.sincronizacionSubject.asObservable();

  constructor() {
    this.cargarAlertaActiva();
  }

  /** Cargar alerta activa del usuario actual */
  private cargarAlertaActiva(): void {
    const usuarioId = 1; // TODO: Obtener del auth service
    this.http.get<AlertaActiva[]>(`${this.apiUrl}/alertasActivas?usuarioId=${usuarioId}`).subscribe({
      next: (alertas) => {
        const alertaActiva = alertas.find(a => a.estado === 'active');
        this.alertaActivaSubject.next(alertaActiva || null);
      },
      error: (error) => {
        console.error('Error al cargar alerta activa:', error);
        this.alertaActivaSubject.next(null);
      }
    });
  }

  /** Activar alerta de emergencia */
  activarAlerta(ubicacion: Ubicacion): Observable<AlertaActiva> {
    console.log('🚀 Iniciando activación de alerta');
    const usuarioId = 1; // TODO: Obtener del auth service
    const nuevaAlerta: Partial<AlertaActiva> = {
      usuarioId,
      estado: 'active',
      tipo: 'emergency',
      mensaje: 'Alerta de emergencia activada',
      ubicacion,
      dispositivoOrigen: 'web',
      sincronizado: false,
      contactosNotificados: [],
      started_at: new Date().toISOString(),
      ended_at: null
    };

    console.log('📤 Enviando alerta al servidor:', nuevaAlerta);
    console.log('🌐 URL:', `${this.apiUrl}/alertasActivas`);

    return this.http.post<AlertaActiva>(`${this.apiUrl}/alertasActivas`, nuevaAlerta).pipe(
      switchMap((alertaCreada) => {
        console.log('✅ Alerta creada en servidor:', alertaCreada);
        this.alertaActivaSubject.next(alertaCreada);
        // Notificar a contactos
        return this.notificarContactos(usuarioId, alertaCreada.id);
      }),
      switchMap(() => {
        // Sincronizar con otros dispositivos
        return this.sincronizarDispositivos(usuarioId);
      })
    );
  }

  /** Activar alerta de emergencia (modo simulación sin servidor) */
  activarAlertaSimulada(ubicacion: Ubicacion): void {
    console.log('🎭 Activando alerta en modo simulación');
    const usuarioId = 1;
    const alertaSimulada: AlertaActiva = {
      id: Date.now().toString(),
      usuarioId,
      estado: 'active',
      tipo: 'emergency',
      mensaje: 'Alerta de emergencia activada',
      ubicacion,
      dispositivoOrigen: 'web',
      sincronizado: true,
      contactosNotificados: [1, 2, 3],
      started_at: new Date().toISOString(),
      ended_at: null
    };

    console.log('📱 Simulando notificación a contactos...');
    console.log('📱 Simulando sincronización con Android...');

    this.alertaActivaSubject.next(alertaSimulada);
    console.log('✅ Alerta activada en modo simulación');
  }

  /** Desactivar alerta */
  desactivarAlerta(): Observable<void> {
    const alertaActual = this.alertaActivaSubject.value;
    if (!alertaActual) {
      return of(void 0);
    }

    const alertaActualizada = {
      ...alertaActual,
      estado: 'resolved' as const,
      ended_at: new Date().toISOString()
    };

    return this.http.patch<void>(`${this.apiUrl}/alertasActivas/${alertaActual.id}`, alertaActualizada).pipe(
      switchMap(() => {
        this.alertaActivaSubject.next(null);
        return this.sincronizarDispositivos(alertaActual.usuarioId);
      })
    );
  }

  /** Notificar a contactos de emergencia */
  private notificarContactos(usuarioId: number, alertaId: string): Observable<any> {
    return this.http.get<ContactoEmergencia[]>(`${this.apiUrl}/contactosEmergencia?usuarioId=${usuarioId}`).pipe(
      switchMap((contactos) => {
        const contactosActualizados = contactos.map(contacto => ({
          ...contacto,
          notificado: true,
          ultimaNotificacion: new Date().toISOString()
        }));

        // Actualizar cada contacto
        const actualizaciones = contactosActualizados.map(contacto =>
          this.http.patch(`${this.apiUrl}/contactosEmergencia/${contacto.id}`, contacto)
        );

        // Actualizar alerta con lista de contactos notificados
        const contactosIds = contactos.map(c => c.id);
        return this.http.patch(`${this.apiUrl}/alertasActivas/${alertaId}`, {
          contactosNotificados: contactosIds
        }).pipe(
          switchMap(() => {
            // Simular envío de notificaciones (SMS, email, etc.)
            console.log('📱 Notificaciones enviadas a:', contactos.map(c => c.nombre));
            return of(contactosActualizados);
          })
        );
      })
    );
  }

  /** Sincronizar alerta con otros dispositivos */
  private sincronizarDispositivos(usuarioId: number): Observable<any> {
    return this.http.get<Dispositivo[]>(`${this.apiUrl}/dispositivos?usuarioId=${usuarioId}`).pipe(
      switchMap((dispositivos) => {
        const dispositivosActivos = dispositivos.filter(d => d.activo && d.tipo !== 'web');

        if (dispositivosActivos.length === 0) {
          console.log('📱 No hay dispositivos Android activos para sincronizar');
          this.sincronizacionSubject.next(true);
          return of(void 0);
        }

        console.log('📱 Sincronizando con dispositivos:', dispositivosActivos.map(d => d.nombre));
        // Simular sincronización con dispositivos Android
        this.sincronizacionSubject.next(true);

        // Actualizar estado de sincronización en la alerta
        const alertaActual = this.alertaActivaSubject.value;
        if (alertaActual) {
          return this.http.patch(`${this.apiUrl}/alertasActivas/${alertaActual.id}`, {
            sincronizado: true
          });
        }

        return of(void 0);
      })
    );
  }

  /** Obtener dispositivos del usuario */
  getDispositivos(usuarioId: number): Observable<Dispositivo[]> {
    return this.http.get<Dispositivo[]>(`${this.apiUrl}/dispositivos?usuarioId=${usuarioId}`);
  }

  /** Obtener contactos de emergencia */
  getContactosEmergencia(usuarioId: number): Observable<ContactoEmergencia[]> {
    return this.http.get<ContactoEmergencia[]>(`${this.apiUrl}/contactosEmergencia?usuarioId=${usuarioId}`);
  }

  /** Actualizar ubicación de la alerta activa */
  actualizarUbicacion(ubicacion: Ubicacion): Observable<void> {
    const alertaActual = this.alertaActivaSubject.value;
    if (!alertaActual) {
      return of(void 0);
    }

    return this.http.patch<void>(`${this.apiUrl}/alertasActivas/${alertaActual.id}`, {
      ubicacion
    }).pipe(
      switchMap(() => {
        this.alertaActivaSubject.next({
          ...alertaActual,
          ubicacion
        });
        return this.sincronizarDispositivos(alertaActual.usuarioId);
      })
    );
  }

  /** Verificar si hay una alerta activa */
  hayAlertaActiva(): boolean {
    return this.alertaActivaSubject.value?.estado === 'active';
  }

  /** Obtener alerta activa actual */
  getAlertaActiva(): AlertaActiva | null {
    return this.alertaActivaSubject.value;
  }

  /** Verificar si el usuario tiene suficientes contactos de emergencia */
  verificarContactosSuficientes(usuarioId: number): Observable<boolean> {
    return this.getContactosEmergencia(usuarioId).pipe(
      switchMap((contactos) => {
        const suficientes = contactos.length >= 3;
        if (!suficientes) {
          console.warn(`⚠️ Usuario ${usuarioId} solo tiene ${contactos.length} contactos (mínimo 3 requeridos)`);
        }
        return of(suficientes);
      })
    );
  }
}