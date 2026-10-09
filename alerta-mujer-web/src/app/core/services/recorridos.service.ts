import { Injectable, signal } from '@angular/core';

export interface PuntoGPS {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface Recorrido {
  id: string;
  fecha: string;
  tiempoEstimado: string;
  distanciaEstimada: string;
  barrioInicio: string;
  barrioFin: string;
  municipio: string;
  departamento: string;
  pais: string;
  puntos: PuntoGPS[];
  cantidadPuntos: number;
  esManual: boolean;
  nombrePersonalizado?: string;
  importante: boolean;
}

const STORAGE_KEY = 'alerta_mujer_recorridos';

@Injectable({ providedIn: 'root' })
export class RecorridosService {
  private recorridos = signal<Recorrido[]>(this.loadRecorridos());

  get recorridos$() {
    return this.recorridos;
  }

  agregarRecorrido(recorrido: Omit<Recorrido, 'id'>): void {
    const nuevoRecorrido: Recorrido = {
      ...recorrido,
      id: Date.now().toString(),
    };
    this.recorridos.update(prev => [nuevoRecorrido, ...prev]);
    this.saveRecorridos();
  }

  eliminarRecorrido(id: string): void {
    this.recorridos.update(prev => prev.filter(r => r.id !== id));
    this.saveRecorridos();
  }

  toggleImportante(id: string): void {
    this.recorridos.update(prev =>
      prev.map(r => r.id === id ? { ...r, importante: !r.importante } : r)
    );
    this.saveRecorridos();
  }

  actualizarRecorrido(id: string, cambios: Partial<Recorrido>): void {
    this.recorridos.update(prev =>
      prev.map(r => r.id === id ? { ...r, ...cambios } : r)
    );
    this.saveRecorridos();
  }

  private loadRecorridos(): Recorrido[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveRecorridos(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.recorridos()));
    } catch (error) {
      console.error('Error al guardar recorridos:', error);
    }
  }
}
