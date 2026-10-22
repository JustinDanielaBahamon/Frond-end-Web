export interface ManualZone {
  id: number;
  name: string;
  level: 'Alto' | 'Medio' | 'Bajo';
  method: 'pin' | 'area';
  radio?: number;
  centerLat: number;
  centerLng: number;
  alertsInZone: number;
}

export interface HotZone {
  name: string;
  lat: number;
  lng: number;
  alerts: number;
  level: 'Alto' | 'Medio' | 'Bajo';
}

/** Tipos de punto de apoyo: los mismos resource_type que acepta el backend (con ubicación). */
export type PointType =
  | 'police_post' | 'police_station' | 'hospital' | 'health_center'
  | 'ambulance' | 'fire_station' | 'support_organization';

/** Capa del mapa en la que se muestra cada tipo. */
export type PointLayer = 'cais' | 'hospitals' | 'support';

export const POINT_TYPES: Record<PointType, { label: string; emoji: string; background: string; layer: PointLayer }> = {
  police_post:          { label: 'CAI',                    emoji: '🚔', background: '#ede9fe', layer: 'cais' },
  police_station:       { label: 'Estación de policía',    emoji: '👮', background: '#ede9fe', layer: 'cais' },
  hospital:             { label: 'Hospital',               emoji: '🏥', background: '#fae8ff', layer: 'hospitals' },
  health_center:        { label: 'Centro de salud',        emoji: '🩺', background: '#fae8ff', layer: 'hospitals' },
  ambulance:            { label: 'Base de ambulancias',    emoji: '🚑', background: '#fae8ff', layer: 'hospitals' },
  fire_station:         { label: 'Bomberos',               emoji: '🚒', background: '#f3e8ff', layer: 'support' },
  support_organization: { label: 'Apoyo a mujeres',        emoji: '💜', background: '#f3e8ff', layer: 'support' },
};

export interface MapPoint {
  id: number;
  type: PointType;
  name: string;
  lat: number;
  lng: number;
}