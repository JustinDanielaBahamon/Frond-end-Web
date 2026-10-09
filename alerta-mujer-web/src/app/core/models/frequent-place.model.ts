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
  notes?: string;
  riskLevel?: 'muy_segura' | 'moderada' | 'muy_insegura';
  isActive?: boolean;
  isMain?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
