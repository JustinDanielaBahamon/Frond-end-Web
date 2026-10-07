export type PlaceType = 'home' | 'work' | 'study' | 'other';

export interface FrequentPlace {
  id: number;
  userId: number;
  name: string;
  // El backend no clasifica los lugares por tipo: siempre se normaliza a 'other'.
  type: PlaceType;
  address: string;
  city: string;
  lat: number;
  lng: number;
  notes?: string;
  riskLevel?: string;
}
