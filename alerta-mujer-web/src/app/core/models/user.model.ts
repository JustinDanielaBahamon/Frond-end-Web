export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  fechaRegistro: string;
  alertas: number;
  ultimaActividad: string;
  estado: 'Activa' | 'Inactiva' | 'Bloqueada por Fraude';
  rol: string;
  contactoEmergencia: string;
  avatarColor: string;
}