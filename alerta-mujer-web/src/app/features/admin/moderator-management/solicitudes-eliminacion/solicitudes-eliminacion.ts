import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SolicitudEliminacion, UsersService } from '../../../../core/services/users.services';
import { AuthService } from '../../../../core/auth/auth.service';

/**
 * Solicitudes para eliminar cuentas (se piden en Gestión de usuarios). Eliminar borra los datos
 * personales y no se puede deshacer, por eso la aprueba una administradora distinta de quien la pidió.
 */
@Component({
  selector: 'app-solicitudes-eliminacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './solicitudes-eliminacion.html',
  styleUrl: './solicitudes-eliminacion.scss',
})
export class SolicitudesEliminacion implements OnInit {
  private usersService = inject(UsersService);
  private cdr = inject(ChangeDetectorRef);
  private miId = inject(AuthService).getCurrentUser()?.id ?? null;

  solicitudes: SolicitudEliminacion[] = [];
  notaDecision: Record<number, string> = {};
  errorSolicitud = '';

  get solicitudesPendientes(): SolicitudEliminacion[] {
    return this.solicitudes.filter(s => s.status === 'pending');
  }

  get solicitudesDecididas(): SolicitudEliminacion[] {
    return this.solicitudes.filter(s => s.status !== 'pending').slice(0, 5);
  }

  ngOnInit(): void {
    this.cargarSolicitudes();
  }

  cargarSolicitudes(): void {
    this.usersService.solicitudesEliminacion().subscribe({
      next: (lista) => {
        this.solicitudes = lista;
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  esMia(s: SolicitudEliminacion): boolean {
    return this.miId != null && String(s.requestedBy) === String(this.miId);
  }

  decidir(s: SolicitudEliminacion, aprobar: boolean): void {
    if (aprobar && !confirm(`¿Eliminar la cuenta de ${s.userName ?? 'esta usuaria'}? Sus datos personales se borran y no se puede deshacer.`)) return;
    this.errorSolicitud = '';
    this.usersService.decidirEliminacion(s.id, aprobar, this.notaDecision[s.id] ?? '').subscribe({
      next: () => this.cargarSolicitudes(),
      error: (err) => {
        this.errorSolicitud = err?.error?.message ?? 'No se pudo registrar la decisión.';
        this.cdr.detectChanges();
      },
    });
  }
}
