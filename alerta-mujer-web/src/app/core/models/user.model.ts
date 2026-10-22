export interface ManagedUser {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  registeredAt: string;
  alerts: number;
  lastActivity: string;
  estado: 'Activa' | 'Inactiva' | 'Bloqueada por Fraude';
  role: string;
  emergencyContact?: string;
  avatarColor: string;
  role_id?: number;
  first_name?: string;
  last_name?: string;
  document_number?: string;
  document_type?: string;
  birthdate?: string | null;
  created_at?: string;
}