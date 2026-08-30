export interface UbicacionEntry {
  id: string;
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
}