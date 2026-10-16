import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { EmergencyContactService } from './emergency-contact.service';
import { DeviceService } from './device.service';
import {
  EstadoSeguridad,
  RequisitoSeguridad,
  NivelSeguridad,
  ColorIndicador
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

  getSecurityStatus(): Observable<EstadoSeguridad> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return of(this.armar(0, 0, 0, false));
    }

    return forkJoin({
      contactos: this.contactService.getByUsuario(user.id).pipe(catchError(() => of([]))),
      celulares: this.deviceService.getMyDevices().pipe(catchError(() => of([]))),
    }).pipe(
      map(({ contactos, celulares }) => this.armar(
        contactos.length,
        contactos.filter((c: { email?: string | null }) => !!c.email).length,
        celulares.length,
        celulares.some(d => !!d.fcmToken),
      ))
    );
  }

  private armar(contactos: number, conCorreo: number, celulares: number, recibeAlertas: boolean): EstadoSeguridad {
    const requisitos: RequisitoSeguridad[] = [
      {
        key: 'contactos',
        label: 'Contactos de emergencia',
        cumplido: contactos >= 1,
        valor: `${contactos} contacto${contactos !== 1 ? 's' : ''}`,
        icon: 'ti-users',
      },
      {
        key: 'correo',
        label: 'Contactos con correo',
        cumplido: conCorreo >= 1,
        valor: conCorreo ? `${conCorreo} reciben el enlace` : 'Ninguno',
        icon: 'ti-mail',
      },
      {
        key: 'celular',
        label: 'Celular vinculado',
        cumplido: celulares >= 1,
        valor: celulares ? `${celulares} celular${celulares !== 1 ? 'es' : ''}` : 'Sin vincular',
        icon: 'ti-device-mobile',
      },
      {
        key: 'alertas',
        label: 'Notificaciones en el celular',
        cumplido: recibeAlertas,
        valor: recibeAlertas ? 'Activas' : 'Inactivas',
        icon: 'ti-bell',
      },
    ];

    const fallidos = requisitos.filter(r => !r.cumplido).length;
    let nivel: NivelSeguridad;
    let color: ColorIndicador;
    if (contactos === 0 || fallidos >= 2) {
      nivel = 'critico';
      color = 'rojo';
    } else if (fallidos === 1) {
      nivel = 'advertencia';
      color = 'amarillo';
    } else {
      nivel = 'seguro';
      color = 'verde';
    }

    return {
      cantidadContactos: contactos,
      requisitos,
      nivel,
      color,
      porcentaje: Math.round(((requisitos.length - fallidos) / requisitos.length) * 100),
    };
  }
}
