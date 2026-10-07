export type ZoneType = 'safe' | 'risk' | 'help';

export interface NearbyZone {
  id: number;
  name: string;
  type: ZoneType;
  description: string;
  address?: string;
  city?: string;
  riskLevel?: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  // No viene del backend: se calcula en el frontend con Haversine
  // desde la última ubicación registrada de la usuaria.
  distanceKm?: number;
}
