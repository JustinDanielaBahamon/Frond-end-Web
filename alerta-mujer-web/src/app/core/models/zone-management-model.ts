export type ZoneType = 'Riesgo Alto' | 'Riesgo Medio' | 'Riesgo Bajo' | 'Segura';
export type ZoneStatus = 'Activa' | 'Revisión' | 'Inactiva';

export interface Zone {
  id: string;
  nombre: string;
  city: string;
  tipo: ZoneType;
  alerts: number;
  estado: ZoneStatus;
  updated_at: string;

  // Ubicación en el mapa (opcional: las zonas antiguas no la tienen)
  lat?: number;
  lng?: number;
  radio?: number; // metros
}