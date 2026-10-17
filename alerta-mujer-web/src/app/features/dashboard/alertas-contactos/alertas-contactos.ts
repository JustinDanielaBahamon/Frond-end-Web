import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ReceivedAlertsService } from '../../../core/services/received-alerts.service';

/** "Alertas de mis contactos": las alertas de las personas que me tienen como contacto de emergencia. */
@Component({
  selector: 'app-alertas-contactos',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './alertas-contactos.html',
  styleUrl: './alertas-contactos.scss',
})
export class AlertasContactosComponent implements OnInit {
  readonly servicio = inject(ReceivedAlertsService);
  private router = inject(Router);

  readonly abriendo = signal<number | null>(null);
  readonly error = signal('');

  ngOnInit(): void {
    this.servicio.consultar();
  }

  async verSeguimiento(id: number): Promise<void> {
    this.error.set('');
    this.abriendo.set(id);
    try {
      const codigo = await this.servicio.codigoSeguimiento(id);
      await this.router.navigate(['/seguimiento', codigo]);
    } catch {
      this.error.set('No se pudo abrir el seguimiento. Puede que la alerta ya haya terminado.');
    } finally {
      this.abriendo.set(null);
    }
  }
}
