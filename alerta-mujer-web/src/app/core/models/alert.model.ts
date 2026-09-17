export interface Alerta {
  id: number;
  nombre: string;
  descripcion: string;
  tipo: 'SOS' | 'Medical' | 'Robo' | 'Acoso';
  medioActivacion: 'Botón de pánico' | 'Widget' | 'Movimiento sospechoso' | 'Manual';
  tiempo: string;
  ubicacion: string;
  lat: number;
  lng: number;
  estado: 'Pendiente' | 'Atendida' | 'Cancelada';
  usuarioId?: number; // 👈 opcional: admin no lo usa, usuaria sí lo necesita para filtrar
}