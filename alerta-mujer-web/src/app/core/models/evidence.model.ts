export interface Evidencia {
  id: number;
  usuarioId: number;
  tipo: 'video' | 'foto' | 'audio';
  nombre: string;
  tamanio: string;
  fecha: string;
  alerta: string; // referencia visual, ej. '#024'
  estado: 'En la nube' | 'Pendiente';
}