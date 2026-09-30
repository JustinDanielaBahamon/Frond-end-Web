export type TipoZona = 'Riesgo Alto' | 'Riesgo Medio' | 'Riesgo Bajo' | 'Segura';
export type EstadoZona = 'Activa' | 'Revisión' | 'Inactiva';

export interface Zona {
  id: string;
  nombre: string;
  ciudad: string;
  tipo: TipoZona;
  alertas: number;
  estado: EstadoZona;
  updated_at: string;

  // Ubicación en el mapa (opcional: las zonas antiguas no la tienen)
  lat?: number;
  lng?: number;
  radio?: number; // metros
}