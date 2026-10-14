import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FrequentPlaceService } from '../../../core/services/frequent-places.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FrequentPlace } from '../../../core/models/frequent-place.model';

@Component({
  selector: 'app-guardar-ubicacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './guardar-ubicacion.html',
  styleUrl: './guardar-ubicacion.scss'
})
export class GuardarUbicacionComponent {
  private frequentPlaceService = inject(FrequentPlaceService);
  private authService = inject(AuthService);

  nombre = signal('');
  direccion = signal('');
  ciudad = signal('');
  notas = signal('');
  nivelRiesgo = signal<'muy_segura' | 'moderada' | 'muy_insegura'>('moderada');
  esPrincipal = signal(false);

  latitud = signal(0);
  longitud = signal(0);
  ubicacionSeleccionada = false;

  loading = signal(false);
  error = signal('');
  exito = signal(false);

  obtenerUbicacionActual() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.latitud.set(position.coords.latitude);
          this.longitud.set(position.coords.longitude);
          this.ubicacionSeleccionada = true;
          this.error.set('');
        },
        (error) => {
          this.error.set('No se pudo obtener la ubicación. Por favor, selecciona manualmente.');
          console.error('Error al obtener ubicación:', error);
        }
      );
    } else {
      this.error.set('Geolocalización no soportada en este navegador.');
    }
  }

  guardar() {
    if (!this.nombre() || !this.direccion()) {
      this.error.set('Por favor completa el nombre y la dirección.');
      return;
    }

    if (!this.ubicacionSeleccionada) {
      this.error.set('Por favor selecciona una ubicación en el mapa.');
      return;
    }

    this.authService.currentUser$.subscribe((user: any) => {
      if (!user) {
        this.error.set('Debes estar autenticado para guardar ubicaciones.');
        return;
      }

      this.loading.set(true);
      this.error.set('');

      const nuevaUbicacion = {
        name: this.nombre(),
        address: this.direccion(),
        city: this.ciudad(),
        notes: this.notas(),
        riskLevel: this.nivelRiesgo(),
        type: 'other' as const,
        lat: this.latitud(),
        lng: this.longitud(),
        isMain: this.esPrincipal()
      };

      this.frequentPlaceService.create(nuevaUbicacion as any).subscribe({
        next: () => {
          this.loading.set(false);
          this.exito.set(true);
          setTimeout(() => {
            this.exito.set(false);
            this.limpiarFormulario();
          }, 2000);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set('Error al guardar la ubicación. Por favor intenta nuevamente.');
          console.error('Error al guardar ubicación:', err);
        }
      });
    });
  }

  limpiarFormulario() {
    this.nombre.set('');
    this.direccion.set('');
    this.ciudad.set('');
    this.notas.set('');
    this.nivelRiesgo.set('moderada');
    this.esPrincipal.set(false);
    this.latitud.set(0);
    this.longitud.set(0);
    this.ubicacionSeleccionada = false;
  }
}
