export interface ContactoEmergencia {
  id: number;
  usuarioId: number;
  nombre: string;
  telefono: string;
  relacion: string;
  prioridad: number; // 1 = más importante
  activo: boolean;
}