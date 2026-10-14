import { Injectable } from '@angular/core';
import { Observable, fromEvent, merge } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { DeviceInfo } from '../models/device-info.model';

@Injectable({
  providedIn: 'root'
})
export class DeviceInfoService {

  getDeviceInfo(): DeviceInfo {
    const ua = navigator.userAgent;
    return {
      browser: this.detectBrowser(ua),
      version: this.detectVersion(ua),
      os: this.detectOS(ua),
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenResolution: `${screen.width}x${screen.height}`,
      userAgent: ua
    };
  }

  isOnline(): Observable<boolean> {
    return merge(
      fromEvent(window, 'online').pipe(map(() => true)),
      fromEvent(window, 'offline').pipe(map(() => false))
    ).pipe(
      startWith(navigator.onLine)
    );
  }

  getConnectionQuality(): string {
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      if (conn && conn.effectiveType) {
        const types: Record<string, string> = {
          'slow-2g': 'Muy lenta (2G)',
          '2g': 'Lenta (2G)',
          '3g': 'Media (3G)',
          '4g': 'Buena (4G)'
        };
        return types[conn.effectiveType] || 'Desconocida';
      }
    }
    // Clarify this is not an error, just an unsupported API (Chromium-only)
    return 'No soportado por navegador';
  }

  getScreenInfo(): { width: number; height: number; dpr: number } {
    return {
      width: screen.width,
      height: screen.height,
      dpr: window.devicePixelRatio || 1
    };
  }

  getCurrentPosition(): Observable<GeolocationPosition | null> {
    return new Observable(observer => {
      if (!('geolocation' in navigator)) {
        observer.next(null);
        observer.complete();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        position => {
          observer.next(position);
          observer.complete();
        },
        error => {
          console.error('Error getting position:', error);
          observer.next(null);
          observer.complete();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  private detectBrowser(ua: string): string {
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('SamsungBrowser')) return 'Samsung Internet';
    if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    return 'Desconocido';
  }

  private detectVersion(ua: string): string {
    const patterns = [
      { regex: /Firefox\/(\d+\.\d+)/, name: 'Firefox' },
      { regex: /SamsungBrowser\/(\d+\.\d+)/, name: 'Samsung' },
      { regex: /OPR\/(\d+\.\d+)/, name: 'Opera' },
      { regex: /Edg\/(\d+\.\d+)/, name: 'Edge' },
      { regex: /Chrome\/(\d+\.\d+)/, name: 'Chrome' },
      { regex: /Version\/(\d+\.\d+).*Safari/, name: 'Safari' }
    ];

    for (const pattern of patterns) {
      const match = ua.match(pattern.regex);
      if (match) return match[1];
    }
    return '';
  }

  private detectOS(ua: string): string {
    if (ua.includes('Windows NT 10.0')) return 'Windows 10/11';
    if (ua.includes('Windows NT 6.3')) return 'Windows 8.1';
    if (ua.includes('Windows NT 6.2')) return 'Windows 8';
    if (ua.includes('Windows NT 6.1')) return 'Windows 7';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac OS X')) {
      const match = ua.match(/Mac OS X (\d+[._]\d+)/);
      if (match) {
        const version = match[1].replace('_', '.');
        return `macOS ${version}`;
      }
      return 'macOS';
    }
    if (ua.includes('Android')) {
      const match = ua.match(/Android (\d+\.?\d*)/);
      return match ? `Android ${match[1]}` : 'Android';
    }
    if (ua.includes('iPhone') || ua.includes('iPad')) {
      const match = ua.match(/OS (\d+)_(\d+)/);
      return match ? `iOS ${match[1]}.${match[2]}` : 'iOS';
    }
    if (ua.includes('Linux')) return 'Linux';
    return 'Desconocido';
  }
}
