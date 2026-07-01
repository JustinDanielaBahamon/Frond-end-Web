export interface Alerta {
  id: number;
  nombre: string;
  descripcion: string;
  tipo: 'SOS' | 'Medical' | 'Robo' | 'Acoso';
  tiempo: string;
  ubicacion: string;
  lat: number;
  lng: number;
  estado: 'Pendiente' | 'Atendida';
}