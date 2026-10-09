import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RecorridosService, Recorrido } from '../../../core/services/recorridos.service';

@Component({
  selector: 'app-historial-recorridos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './historial-recorridos.html',
  styleUrl: './historial-recorridos.scss'
})
export class HistorialRecorridosComponent {
  private recorridosService = inject(RecorridosService);

  recorridos = this.recorridosService.recorridos$;
  selectedRecorrido = signal<Recorrido | null>(null);

  formatearFecha = (fecha: string) => {
    const date = new Date(fecha);
    return date.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  confirmarEliminar = (id: string, nombre: string) => {
    if (confirm(`¿Estás segura de que quieres eliminar el recorrido "${nombre}"?`)) {
      this.recorridosService.eliminarRecorrido(id);
    }
  };

  toggleImportante = (id: string) => {
    this.recorridosService.toggleImportante(id);
  };

  recorridosOrdenados = computed(() => {
    return this.recorridos().sort((a, b) => {
      if (a.importante && !b.importante) return -1;
      if (!a.importante && b.importante) return 1;
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    });
  });
}
