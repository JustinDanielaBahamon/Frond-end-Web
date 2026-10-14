export type ZoneType = 'safe' | 'risk' | 'help' | 'policia' | 'asistencia';

export interface NearbyZone {
  id: number;
  name: string;
  type: ZoneType;
  description?: string;
  address?: string;
  city?: string;
  distanceKm?: number;
  lat: number;
  lng: number;
  radiusMeters?: number;
  riskLevel?: string;
  isActive?: boolean;
}
