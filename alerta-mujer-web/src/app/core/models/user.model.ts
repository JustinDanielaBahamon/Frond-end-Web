export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  correo?: string;
  telefono: string;
  fechaRegistro: string;
  alertas: number;
  ultimaActividad: string;
  estado: 'Activa' | 'Inactiva' | 'Bloqueada por Fraude';
  rol: string;
  contactoEmergencia?: string;
  avatarColor: string;
  role_id?: number;
  first_name?: string;
  last_name?: string;
  document_number?: string;
  document_type?: string;
  birthdate?: string | null;
  created_at?: string;
}