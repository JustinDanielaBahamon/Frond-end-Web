export interface Alerta {
  id: number;
  nombre: string;
  descripcion: string;
  tipo: 'SOS' | 'Medical' | 'Robo' | 'Acoso';
  tiempo: string;
  ubicacion: string;
  lat: number;
  lng: number;
  estado: 'Pendiente' | 'Atendida' | 'Falsa alarma';
  usuarioId?: number; // 👈 opcional: admin no lo usa, usuaria sí lo necesita para filtrar
}