import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, from, of } from 'rxjs';
import { map, catchError, take } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { EmergencyContactService } from './emergency-contact.service';
import { 
  EstadoSeguridad, 
  RequisitoSeguridad, 
  NivelSeguridad, 
  ColorIndicador 
} from '../models/security-status.model';

@Injectable({ providedIn: 'root' })
export class UserSecurityStatusService {
  private authService = inject(AuthService);
  private contactService = inject(EmergencyContactService);

  getSecurityStatus(): Observable<EstadoSeguridad> {
    const user = this.authService.getCurrentUser();

    if (!user) {
      return of(this.createDefaultCriticoEstado());
    }

    return forkJoin({
      cantidadContactos: this.contactService.getByUsuario(user.id).pipe(
        map(contacts => contacts.length),
        catchError(() => of(0))
      ),
      locationGranted: this.checkGeolocationPermission(),
      notifGranted: this.checkNotificationPermission(),
      activationMethod: this.checkActivationMethod(),
    }).pipe(
      map(({ cantidadContactos, locationGranted, notifGranted, activationMethod }) => {
        const requisitos: RequisitoSeguridad[] = [
          {
            key: 'contactos',
            label: 'Contactos de emergencia',
            cumplido: cantidadContactos >= 2,
            valor: `${cantidadContactos} contacto${cantidadContactos !== 1 ? 's' : ''}`,
            icon: 'ti-users',
          },
          {
            key: 'activacion',
            label: 'Método de activación',
            cumplido: !!activationMethod,
            valor: activationMethod || 'No configurado',
            icon: 'ti-shield-check',
          },
          {
            key: 'ubicacion',
            label: 'Ubicación',
            cumplido: locationGranted,
            valor: locationGranted ? 'Activa' : 'Inactiva',
            icon: 'ti-map-pin',
          },
          {
            key: 'notificaciones',
            label: 'Notificaciones',
            cumplido: notifGranted,
            valor: notifGranted ? 'Activas' : 'Inactivas',
            icon: 'ti-bell',
          },
        ];

        const failedCount = requisitos.filter(r => !r.cumplido).length;
        let nivel: NivelSeguridad;
        let color: ColorIndicador;

        if (cantidadContactos < 2 || failedCount >= 2) {
          nivel = 'critico';
          color = 'rojo';
        } else if (failedCount === 1) {
          nivel = 'advertencia';
          color = 'amarillo';
        } else {
          nivel = 'seguro';
          color = 'verde';
        }

        const porcentaje = Math.round((requisitos.filter(r => r.cumplido).length / 4) * 100);

        return {
          cantidadContactos,
          requisitos,
          nivel,
          color,
          porcentaje,
        };
      })
    );
  }

  private checkGeolocationPermission(): Observable<boolean> {
    if (!navigator.permissions) {
      return of(false);
    }

    return from(
      navigator.permissions.query({ name: 'geolocation' as PermissionName })
        .then(result => result.state === 'granted')
        .catch(() => false)
    );
  }

  private checkNotificationPermission(): Observable<boolean> {
    return of(
      typeof Notification !== 'undefined' && Notification.permission === 'granted'
    );
  }

  private checkActivationMethod(): Observable<string | null> {
    // TODO: Replace with actual backend call when endpoint exists (e.g., GET /api/profile or /api/user-profile)
    // Until then, return null to reflect that activation method is not yet configured/verified
    // This ensures users see an honest "not configured" status rather than a false positive
    return of(null);
  }

  private createDefaultCriticoEstado(): EstadoSeguridad {
    return {
      cantidadContactos: 0,
      requisitos: [
        {
          key: 'contactos',
          label: 'Contactos de emergencia',
          cumplido: false,
          valor: '0 contactos',
          icon: 'ti-users',
        },
        {
          key: 'activacion',
          label: 'Método de activación',
          cumplido: false,
          valor: 'No configurado',
          icon: 'ti-shield-check',
        },
        {
          key: 'ubicacion',
          label: 'Ubicación',
          cumplido: false,
          valor: 'Inactiva',
          icon: 'ti-map-pin',
        },
        {
          key: 'notificaciones',
          label: 'Notificaciones',
          cumplido: false,
          valor: 'Inactivas',
          icon: 'ti-bell',
        },
      ],
      nivel: 'critico',
      color: 'rojo',
      porcentaje: 0,
    };
  }
}
