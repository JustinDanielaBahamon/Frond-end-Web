export interface ZonaManual {
  id: number;
  nombre: string;
  nivel: 'Alto' | 'Medio' | 'Bajo';
  metodo: 'pin' | 'area';
  radio?: number;
  centroLat: number;
  centroLng: number;
  alertasEnZona: number;
}

export interface ZonaCaliente {
  nombre: string;
  lat: number;
  lng: number;
  alertas: number;
  nivel: 'Alto' | 'Medio' | 'Bajo';
}

export interface PuntoMapa {
  id: number;
  tipo: 'CAI' | 'Hospital';
  nombre: string;
  lat: number;
  lng: number;
}