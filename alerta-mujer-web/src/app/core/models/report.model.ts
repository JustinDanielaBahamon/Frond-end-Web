import { MedioActivacion } from './alert.model';

export type EstadoReporte = 'Pendiente' | 'Cerrada' | 'Atendida';

export interface Reporte {
  id: string;
  nombre: string;
  fecha: string;                     // ISO, ej: 2026-09-26T10:30:00.000Z
  ciudad: string;
  medioActivacion: MedioActivacion;  // 'Botón de pánico' | 'Widget' | 'Movimiento sospechoso' | 'Manual'
  estado: EstadoReporte;
  generadoPor: string;
  exportaciones: number;
}