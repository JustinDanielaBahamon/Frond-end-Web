export type ZoneType = 'safe' | 'risk' | 'help';

export interface NearbyZone {
  id: number;
  name: string;
  type: ZoneType;
  description: string;
  distanceKm: number;
  lat: number;
  lng: number;
  radiusMeters: number;
}
