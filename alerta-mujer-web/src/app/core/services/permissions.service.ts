import { Injectable } from '@angular/core';
import { Observable, from, of, forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { PermissionStatus } from '../models/device-info.model';

type PermissionName = 'geolocation' | 'notifications' | 'camera' | 'microphone' | 'clipboard-read';

@Injectable({
  providedIn: 'root'
})
export class PermissionsService {

  checkPermission(name: PermissionName): Observable<PermissionStatus> {
    // Caso especial para notificaciones
    if (name === 'notifications') {
      return this.checkNotificationPermission();
    }

    // Para otros permisos, intentar usar Permissions API
    if (!('permissions' in navigator)) {
      return of({ 
        name, 
        state: 'unavailable', 
        canRequest: false 
      });
    }

    // Some browsers do not support every permission in the API
    const permissionMap: Record<string, PermissionName> = {
      'geolocation': 'geolocation',
      'camera': 'camera',
      'microphone': 'microphone',
      'clipboard-read': 'clipboard-read'
    };

    const queryName = permissionMap[name] as PermissionName;

    return from(navigator.permissions.query({ name: queryName as any })).pipe(
      map(result => ({
        name,
        state: result.state as 'granted' | 'denied' | 'prompt',
        canRequest: result.state === 'prompt'
      })),
      catchError(() => of({ 
        name, 
        state: 'unavailable' as const, 
        canRequest: false 
      }))
    );
  }

  private checkNotificationPermission(): Observable<PermissionStatus> {
    if (!('Notification' in window)) {
      return of({ 
        name: 'notifications', 
        state: 'unavailable', 
        canRequest: false 
      });
    }

    const permission = Notification.permission;
    const stateMap: Record<NotificationPermission, 'granted' | 'denied' | 'prompt'> = {
      'granted': 'granted',
      'denied': 'denied',
      'default': 'prompt'
    };

    return of({
      name: 'notifications',
      state: stateMap[permission],
      canRequest: permission === 'default'
    });
  }

  requestGeolocation(): Observable<PermissionState> {
    if (!('geolocation' in navigator)) {
      return of('denied' as PermissionState);
    }

    return new Observable<PermissionState>(observer => {
      navigator.geolocation.getCurrentPosition(
        () => {
          observer.next('granted' as PermissionState);
          observer.complete();
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            observer.next('denied' as PermissionState);
          } else {
            observer.next('prompt' as PermissionState);
          }
          observer.complete();
        }
      );
    });
  }

  requestNotifications(): Observable<NotificationPermission> {
    if (!('Notification' in window)) {
      return of('denied' as NotificationPermission);
    }

    if (Notification.permission === 'granted') {
      return of('granted');
    }

    return from(Notification.requestPermission());
  }

  checkAllPermissions(): Observable<PermissionStatus[]> {
    const permissions: PermissionName[] = [
      'geolocation', 
      'notifications',
      'clipboard-read'
    ];

    return forkJoin(
      permissions.map(p => this.checkPermission(p))
    );
  }
}
