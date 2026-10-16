export type NivelSeguridad = 'seguro' | 'advertencia' | 'critico';
export type ColorIndicador = 'verde' | 'amarillo' | 'rojo';

export interface RequisitoSeguridad {
  key: 'contactos' | 'correo' | 'celular' | 'alertas';
  label: string;
  cumplido: boolean;
  valor: string;
  icon: string;
}

export interface EstadoSeguridad {
  cantidadContactos: number;
  requisitos: RequisitoSeguridad[];
  nivel: NivelSeguridad;
  color: ColorIndicador;
  porcentaje: number; // 0-100
}
