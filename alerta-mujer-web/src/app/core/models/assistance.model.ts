/** Category of a help resource, derived from the backend resourceType. */
export type ResourceCategory = 'linea' | 'policia' | 'salud' | 'apoyo' | 'bomberos';

/** Help resource (GET /api/resources) adapted for the UI. */
export interface HelpResource {
  id: number;
  name: string;
  category: ResourceCategory;
  description: string;
  telephone: string | null;
  telephone2: string | null;
  email: string | null;
  address: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
}

/** Call recorded by the user (GET /api/resource-calls/me). */
export interface RecordedCall {
  id: number;
  resourceId: number;
  telephone: string;
  status: string;
  date: Date;
}
