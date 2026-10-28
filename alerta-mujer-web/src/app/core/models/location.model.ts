export interface LocationEntry {
  id: number;
  userId: number;
  time: string;
  address: string;
  gpsSignal: 'Fuerte' | 'Moderada' | 'Débil';
  battery: number;
  lat: number;
  lng: number;
  date?: string;           // 'YYYY-MM-DD' — add it in the backend so the calendar really filters
  connectionType?: string; // opcional
  deviceName?: string;     // opcional
  recordedAt?: string;     // ISO with time zone (source of truth for date/time)
  accuracy?: number;       // metros
}

// Model returned by the backend LocationLog
export interface LocationLogApi {
  id: number;
  userProfileId: number;
  alertId?: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  recordedAt: string;
}