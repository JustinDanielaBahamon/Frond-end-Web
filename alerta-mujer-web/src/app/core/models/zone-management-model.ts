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

  // Location on the map (optional: old zones do not have it)
  lat?: number;
  lng?: number;
  radio?: number; // metros
}