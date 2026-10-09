import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FrequentPlaceService } from '../../../core/services/frequent-places.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FrequentPlace } from '../../../core/models/frequent-place.model';

@Component({
  selector: 'app-ubicaciones-guardadas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ubicaciones-guardadas.html',
  styleUrl: './ubicaciones-guardadas.scss'
})
export class UbicacionesGuardadasComponent implements OnInit {
  private frequentPlaceService = inject(FrequentPlaceService);
  private authService = inject(AuthService);

  ubicaciones = signal<FrequentPlace[]>([]);
  filtroRiesgo = signal<string | null>(null);
  busqueda = signal('');

  loading = signal(true);
  error = signal('');

  ngOnInit() {
    this.authService.currentUser$.subscribe((user: any) => {
      if (!user) {
        this.error.set('Debes estar autenticado para ver tus ubicaciones.');
        this.loading.set(false);
        return;
      }
      this.cargarUbicaciones(user.id);
    });
  }

  cargarUbicaciones(userId: number) {
    this.loading.set(true);
    this.error.set('');

    this.frequentPlaceService.getByUser(userId).subscribe({
      next: (data) => {
        this.ubicaciones.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Error al cargar ubicaciones. Por favor intenta nuevamente.');
        this.loading.set(false);
        console.error('Error al cargar ubicaciones:', err);
      }
    });
  }

  getRiskColor = (nivel?: string) => {
    switch (nivel) {
      case 'muy_segura':
        return '#27AE60';
      case 'moderada':
        return '#D89B00';
      case 'muy_insegura':
        return '#E74C3C';
      default:
        return '#999';
    }
  };

  getRiskLabel = (nivel?: string) => {
    switch (nivel) {
      case 'muy_segura':
        return 'Muy segura';
      case 'moderada':
        return 'Moderada';
      case 'muy_insegura':
        return 'Muy insegura';
      default:
        return 'Sin clasificar';
    }
  };

  getRiskIcon = (nivel?: string) => {
    switch (nivel) {
      case 'muy_segura':
        return 'ti ti-shield-check';
      case 'moderada':
        return 'ti ti-alert-triangle';
      case 'muy_insegura':
        return 'ti ti-alert-circle';
      default:
        return 'ti ti-help';
    }
  };

  ubicacionesFiltradas = computed(() => {
    return this.ubicaciones().filter((ubicacion) => {
      if (this.filtroRiesgo() && ubicacion.riskLevel !== this.filtroRiesgo()) {
        return false;
      }

      if (this.busqueda().trim()) {
        const termino = this.busqueda().toLowerCase();
        return (
          ubicacion.name.toLowerCase().includes(termino) ||
          (ubicacion.address && ubicacion.address.toLowerCase().includes(termino)) ||
          (ubicacion.city && ubicacion.city.toLowerCase().includes(termino))
        );
      }

      return true;
    });
  });

  eliminarUbicacion(id: number) {
    if (confirm('¿Estás segura de eliminar esta ubicación?')) {
      this.frequentPlaceService.delete(id).subscribe({
        next: () => {
          this.ubicaciones.update(prev => prev.filter(u => u.id !== id));
        },
        error: (err) => {
          alert('Error al eliminar la ubicación');
          console.error('Error al eliminar:', err);
        }
      });
    }
  }
}
