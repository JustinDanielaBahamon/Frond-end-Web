export type PlaceType = 'home' | 'work' | 'study' | 'other';

export interface FrequentPlace {
  id: number;
  userId: number;
  name: string;
  type: PlaceType;
  address: string;
  city: string;
  lat: number;
  lng: number;
  isMain?: boolean;
}
