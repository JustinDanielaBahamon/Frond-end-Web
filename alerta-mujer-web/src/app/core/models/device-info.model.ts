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

// Data coming from the backend: null = could not be queried
export interface CriticalFeatureStatus {
  sessionActive: boolean;
  lastLocationCaptured: string | null; // text ready to show; null = the phone never sent a location
  registeredDevices: number | null;
  pushTokenRegistered: boolean;        // some phone has an FCM token (the token is not stored here)
  emergencyContactsCount: number | null;
}
