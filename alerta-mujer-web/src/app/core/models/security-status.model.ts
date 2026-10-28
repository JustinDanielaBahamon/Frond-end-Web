export type SecurityLevel = 'seguro' | 'advertencia' | 'critico';
export type IndicatorColor = 'verde' | 'amarillo' | 'rojo';

export interface SecurityRequirement {
  key: 'contactos' | 'correo' | 'celular' | 'alertas';
  label: string;
  met: boolean;
  value: string;
  icon: string;
}

export interface SecurityStatus {
  contactCount: number;
  requirements: SecurityRequirement[];
  level: SecurityLevel;
  color: IndicatorColor;
  percentage: number; // 0-100
}
