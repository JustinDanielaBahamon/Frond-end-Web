export interface UbicacionEntry {
  id: number;
  usuarioId: number;
  time: string;
  address: string;
  gpsSignal: 'Fuerte' | 'Moderada' | 'Débil';
  battery: number;
  lat: number;
  lng: number;
  date?: string;           // 'YYYY-MM-DD' — agrégalo en el backend para que el calendario filtre de verdad
  connectionType?: string; // opcional
  deviceName?: string;     // opcional
  recordedAt?: string;     // ISO con zona horaria (fuente de verdad para fecha/hora)
  accuracy?: number;       // metros
}

// Modelo que devuelve el backend LocationLog
export interface LocationLogApi {
  id: number;
  userProfileId: number;
  alertId?: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  recordedAt: string;
}