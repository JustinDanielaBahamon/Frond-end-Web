export interface PermissionStatus {
  name: string;
  state: 'granted' | 'denied' | 'prompt' | 'unavailable';
  canRequest: boolean;
}

export interface ServiceStatus {
  name: string;
  enabled: boolean;
  details?: string;
}

export interface DeviceInfo {
  browser: string;
  version: string;
  os: string;
  language: string;
  timezone: string;
  screenResolution: string;
  userAgent: string;
}

export interface ActivityLog {
  timestamp: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

// Datos que vienen del backend: null = no se pudo consultar
export interface CriticalFeatureStatus {
  sessionActive: boolean;
  lastLocationCaptured: string | null; // texto listo para mostrar; null = el celular nunca ha enviado ubicación
  registeredDevices: number | null;
  pushTokenRegistered: boolean;        // algún celular tiene token FCM (no se guarda el token aquí)
  emergencyContactsCount: number | null;
}
