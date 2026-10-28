export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  telephone: string;
  registeredAt: string;
  alerts: number;
  lastActivity: string;
  status: 'Activa' | 'Inactiva' | 'Bloqueada por Fraude';
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