export interface Evidencia {
  id: number;
  usuarioId: number;
  tipo: 'video' | 'foto' | 'audio';
  nombre: string;
  tamanio: string;
  fecha: string; // idealmente ISO parseable, ej. '2026-08-28T20:45:00'
  alerta: string; // ej. '#AM-0025'
  estado: 'En la nube' | 'Pendiente';

  // Nuevos, opcionales: si el backend aún no los manda, la UI usa un respaldo
  // en vez de romperse.
  ubicacion?: string;        // ej. 'Neiva, Huila'
  metodoActivacion?: string; // ej. 'Movimiento brusco'
  archivoUrl?: string;       // imagen/miniatura real. Sin esto, se usa el ícono por tipo.
  duracion?: string;         // solo video/audio, ej. '01:23'
}