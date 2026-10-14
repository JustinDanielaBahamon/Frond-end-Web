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

export interface CriticalFeatureStatus {
  sessionActive: boolean;
  lastLocationCaptured: string | null;
  notificationToken: string | null;
  emergencyContactsCount: number;
}
