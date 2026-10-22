import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { EmergencyContactService } from './emergency-contact.service';
import { DeviceService } from './device.service';
import {
  SecurityStatus,
  SecurityRequirement,
  SecurityLevel,
  IndicatorColor
} from '../models/security-status.model';

/**
 * "Estado de tu seguridad" del panel: lo que de verdad hace que una alerta llegue.
 * Se mide con la cuenta y el celular (no con el navegador, que no envía alertas).
 */
@Injectable({ providedIn: 'root' })
export class UserSecurityStatusService {
  private authService = inject(AuthService);
  private contactService = inject(EmergencyContactService);
  private deviceService = inject(DeviceService);

  getSecurityStatus(): Observable<SecurityStatus> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return of(this.build(0, 0, 0, false));
    }

    return forkJoin({
      contacts: this.contactService.getByUser(user.id).pipe(catchError(() => of([]))),
      celulares: this.deviceService.getMyDevices().pipe(catchError(() => of([]))),
    }).pipe(
      map(({ contacts, celulares }) => this.build(
        contacts.length,
        contacts.filter((c: { email?: string | null }) => !!c.email).length,
        celulares.length,
        celulares.some(d => !!d.fcmToken),
      ))
    );
  }

  private build(contacts: number, withEmail: number, celulares: number, receivesAlerts: boolean): SecurityStatus {
    const requirements: SecurityRequirement[] = [
      {
        key: 'contactos',
        label: 'Contactos de emergencia',
        met: contacts >= 1,
        value: `${contacts} contacto${contacts !== 1 ? 's' : ''}`,
        icon: 'ti-users',
      },
      {
        key: 'correo',
        label: 'Contactos con correo',
        met: withEmail >= 1,
        value: withEmail ? `${withEmail} reciben el enlace` : 'Ninguno',
        icon: 'ti-mail',
      },
      {
        key: 'celular',
        label: 'Celular vinculado',
        met: celulares >= 1,
        value: celulares ? `${celulares} celular${celulares !== 1 ? 'es' : ''}` : 'Sin vincular',
        icon: 'ti-device-mobile',
      },
      {
        key: 'alertas',
        label: 'Notificaciones en el celular',
        met: receivesAlerts,
        value: receivesAlerts ? 'Activas' : 'Inactivas',
        icon: 'ti-bell',
      },
    ];

    const failed = requirements.filter(r => !r.met).length;
    let level: SecurityLevel;
    let color: IndicatorColor;
    if (contacts === 0 || failed >= 2) {
      level = 'critico';
      color = 'rojo';
    } else if (failed === 1) {
      level = 'advertencia';
      color = 'amarillo';
    } else {
      level = 'seguro';
      color = 'verde';
    }

    return {
      contactCount: contacts,
      requirements,
      level,
      color,
      percentage: Math.round(((requirements.length - failed) / requirements.length) * 100),
    };
  }
}
