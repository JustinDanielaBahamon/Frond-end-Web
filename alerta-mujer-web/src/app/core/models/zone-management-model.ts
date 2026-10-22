export type ZoneType = 'Riesgo Alto' | 'Riesgo Medio' | 'Riesgo Bajo' | 'Segura';
export type ZoneStatus = 'Activa' | 'Revisión' | 'Inactiva';

export interface Zone {
  id: string;
  name: string;
  city: string;
  type: ZoneType;
  alerts: number;
  status: ZoneStatus;
  updated_at: string;

  // Ubicación en el mapa (opcional: las zonas antiguas no la tienen)
  lat?: number;
  lng?: number;
  radio?: number; // metros
}