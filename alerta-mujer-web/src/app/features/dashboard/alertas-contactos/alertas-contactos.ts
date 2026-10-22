import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ReceivedAlertsService } from '../../../core/services/received-alerts.service';

/** "Alertas de mis contactos": the alerts of the people who have me as an emergency contact. */
@Component({
  selector: 'app-alertas-contactos',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './alertas-contactos.html',
  styleUrl: './alertas-contactos.scss',
})
export class AlertContactsComponent implements OnInit {
  readonly service = inject(ReceivedAlertsService);
  private router = inject(Router);

  readonly opening = signal<number | null>(null);
  readonly error = signal('');

  ngOnInit(): void {
    this.service.query();
  }

  async viewTracking(id: number): Promise<void> {
    this.error.set('');
    this.opening.set(id);
    try {
      const code = await this.service.trackingCode(id);
      // The flag allows going back to the panel; whoever arrives from the email does not have it
      await this.router.navigate(['/seguimiento', code], { state: { desdePanel: true } });
    } catch {
      this.error.set('No se pudo abrir el seguimiento. Puede que la alerta ya haya terminado.');
    } finally {
      this.opening.set(null);
    }
  }
}
