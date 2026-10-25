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
 * Panel "Estado de tu seguridad": what really makes an alert arrive.
 * It is measured with the account and the phone (not with the browser, which sends no alerts).
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
      phones: this.deviceService.getMyDevices().pipe(catchError(() => of([]))),
    }).pipe(
      map(({ contacts, phones }) => this.build(
        contacts.length,
        contacts.filter((c: { email?: string | null }) => !!c.email).length,
        phones.length,
        phones.some(d => !!d.fcmToken),
      ))
    );
  }

  private build(contacts: number, withEmail: number, phones: number, receivesAlerts: boolean): SecurityStatus {
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
        met: phones >= 1,
        value: phones ? `${phones} celular${phones !== 1 ? 'es' : ''}` : 'Sin vincular',
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
