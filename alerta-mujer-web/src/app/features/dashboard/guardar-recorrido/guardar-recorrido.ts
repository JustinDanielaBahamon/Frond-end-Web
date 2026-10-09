import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecorridosService, PuntoGPS } from '../../../core/services/recorridos.service';
import { FrequentPlaceService } from '../../../core/services/frequent-places.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FrequentPlace } from '../../../core/models/frequent-place.model';

type PuntoSeleccionado = {
  latitude: number;
  longitude: number;
  nombre?: string;
  direccion?: string;
};

type MetodoSeleccion = 'mapa' | 'ubicaciones';

@Component({
  selector: 'app-guardar-recorrido',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './guardar-recorrido.html',
  styleUrl: './guardar-recorrido.scss'
})
export class GuardarRecorridoComponent {
  private recorridosService = inject(RecorridosService);
  private frequentPlaceService = inject(FrequentPlaceService);
  private authService = inject(AuthService);

  puntoA = signal<PuntoSeleccionado | null>(null);
  puntoB = signal<PuntoSeleccionado | null>(null);
  nombrePuntoA = signal('');
  nombrePuntoB = signal('');
  nombreRecorrido = signal('');
  metodoSeleccion = signal<MetodoSeleccion>('mapa');
  puntoSeleccionando = signal<'A' | 'B' | null>(null);

  ubicacionesGuardadas = signal<FrequentPlace[]>([]);
  modalUbicacionesVisible = signal(false);

  loading = signal(false);
  error = signal('');
  exito = signal(false);

  ngOnInit() {
    this.authService.currentUser$.subscribe((user: any) => {
      if (!user) return;
      this.cargarUbicaciones(user.id);
    });
  }

  cargarUbicaciones(userId: number) {
    this.frequentPlaceService.getByUser(userId).subscribe((places) => {
      this.ubicacionesGuardadas.set(places);
    });
  }

  seleccionarEnMapa(punto: 'A' | 'B') {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          if (punto === 'A') {
            this.puntoA.set(coords);
          } else {
            this.puntoB.set(coords);
          }
          this.puntoSeleccionando.set(null);
          this.error.set('');
        },
        (error) => {
          this.error.set('No se pudo obtener la ubicación. Por favor intenta nuevamente.');
          console.error('Error al obtener ubicación:', error);
        }
      );
    } else {
      this.error.set('Geolocalización no soportada en este navegador.');
    }
  }

  seleccionarDesdeUbicaciones(ubicacion: FrequentPlace, punto: 'A' | 'B') {
    const puntoSeleccionado: PuntoSeleccionado = {
      latitude: ubicacion.lat,
      longitude: ubicacion.lng,
      nombre: ubicacion.name,
      direccion: ubicacion.address,
    };

    if (punto === 'A') {
      this.puntoA.set(puntoSeleccionado);
    } else {
      this.puntoB.set(puntoSeleccionado);
    }
    this.modalUbicacionesVisible.set(false);
  }

  iniciarSeleccionPunto(punto: 'A' | 'B') {
    this.puntoSeleccionando.set(punto);
    if (this.metodoSeleccion() === 'ubicaciones') {
      this.modalUbicacionesVisible.set(true);
    }
  }

  guardarRecorrido() {
    if (!this.puntoA() || !this.puntoB()) {
      this.error.set('Por favor selecciona ambos puntos del recorrido');
      return;
    }

    const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const distanciaKm = calcularDistancia(
      this.puntoA()!.latitude,
      this.puntoA()!.longitude,
      this.puntoB()!.latitude,
      this.puntoB()!.longitude
    );

    const velocidadPromedioKmH = 5;
    const tiempoHoras = distanciaKm / velocidadPromedioKmH;
    const tiempoMinutos = Math.round(tiempoHoras * 60);

    let tiempoEstimado = '';
    if (tiempoMinutos < 60) {
      tiempoEstimado = `${tiempoMinutos} min`;
    } else {
      const horas = Math.floor(tiempoMinutos / 60);
      const mins = tiempoMinutos % 60;
      tiempoEstimado = `${horas}h ${mins}min`;
    }

    const hoy = new Date();
    const fecha = hoy.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const nuevoRecorrido = {
      fecha,
      tiempoEstimado,
      distanciaEstimada: `${distanciaKm.toFixed(2)} km`,
      barrioInicio: this.nombrePuntoA() || this.puntoA()!.nombre || 'Punto seleccionado',
      barrioFin: this.nombrePuntoB() || this.puntoB()!.nombre || 'Punto seleccionado',
      municipio: 'Neiva',
      departamento: 'Huila',
      pais: 'Colombia',
      puntos: [
        {
          latitude: this.puntoA()!.latitude,
          longitude: this.puntoA()!.longitude,
          timestamp: '',
        } as PuntoGPS,
        {
          latitude: this.puntoB()!.latitude,
          longitude: this.puntoB()!.longitude,
          timestamp: '',
        } as PuntoGPS,
      ],
      cantidadPuntos: 2,
      esManual: true,
      nombrePersonalizado:
        this.nombreRecorrido() ||
        `Ruta ${this.nombrePuntoA() || this.puntoA()!.nombre || 'A'} → ${
          this.nombrePuntoB() || this.puntoB()!.nombre || 'B'
        }`,
      importante: true,
    };

    this.recorridosService.agregarRecorrido(nuevoRecorrido);
    this.exito.set(true);
    setTimeout(() => {
      this.exito.set(false);
      this.limpiarSeleccion();
    }, 2000);
  }

  limpiarSeleccion() {
    this.puntoA.set(null);
    this.puntoB.set(null);
    this.puntoSeleccionando.set(null);
    this.nombrePuntoA.set('');
    this.nombrePuntoB.set('');
    this.nombreRecorrido.set('');
  }
}
