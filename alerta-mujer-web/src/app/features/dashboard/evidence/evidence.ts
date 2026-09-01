import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { EvidenceService } from '../../../core/services/evidence.service';
import { Evidencia } from '../../../core/models/evidence.model';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-evidence',
  imports: [CommonModule, NgClass],
  templateUrl: './evidence.html',
  styleUrl: './evidence.scss',
})
export class Evidence implements OnInit {

  private evidenceService = inject(EvidenceService);
  private authService = inject(AuthService);

  filtroActivo = 'todos';

  filtros = [
    { key: 'todos',  label: 'Todos' },
    { key: 'video',  label: 'Video' },
    { key: 'foto',   label: 'Foto' },
    { key: 'audio',  label: 'Audio' },
  ];

  evidencias: Evidencia[] = [];
  error = false;

  terminoBusqueda = '';

  // "+N este mes" de cada tarjeta.
  totalEsteMes = 0;
  videosEsteMes = 0;
  fotosEsteMes = 0;
  audiosEsteMes = 0;

  // Estado del botón "Sincronizar ahora" / banner.
  sincronizando = false;
  ultimaSincronizacion: Date | null = null;

  evidenciaSeleccionada: Evidencia | null = null;
  modalAbierto = false;

  ngOnInit() {
    this.authService.currentUser$.subscribe((usuario) => {
      if (!usuario) {
        this.error = true;
        return;
      }

      this.evidenceService.getByUsuario(usuario.id).subscribe({
        next: (data) => {
          this.evidencias = data;
          this.calcularStats(data);
        },
        error: () => {
          this.error = true;
        },
      });
    });
  }

  private calcularStats(evidencias: Evidencia[]) {
    // 👇 asume que 'fecha' es parseable como fecha (ej. "2026-06-12T14:32:00").
    // Si tu formato real es distinto (ej. "27/05/2025 - 12:32 PM"), dime el formato
    // exacto y ajusto el parseo — mientras tanto, si no parsea, simplemente no cuenta
    // ese archivo como "de este mes" (no rompe la pantalla).
    const hoy = new Date();
    const esEsteMes = (fechaTexto: string) => {
      const fecha = new Date(fechaTexto);
      return !isNaN(fecha.getTime()) &&
        fecha.getMonth() === hoy.getMonth() &&
        fecha.getFullYear() === hoy.getFullYear();
    };

    this.totalEsteMes = evidencias.filter(e => esEsteMes(e.fecha)).length;
    this.videosEsteMes = evidencias.filter(e => e.tipo === 'video' && esEsteMes(e.fecha)).length;
    this.fotosEsteMes = evidencias.filter(e => e.tipo === 'foto' && esEsteMes(e.fecha)).length;
    this.audiosEsteMes = evidencias.filter(e => e.tipo === 'audio' && esEsteMes(e.fecha)).length;
  }

  get evidenciasFiltradas(): Evidencia[] {
    let lista = this.filtroActivo === 'todos'
      ? this.evidencias
      : this.evidencias.filter(e => e.tipo === this.filtroActivo);

    const termino = this.terminoBusqueda.trim().toLowerCase();
    if (termino) {
      lista = lista.filter(e =>
        e.nombre.toLowerCase().includes(termino) ||
        e.alerta.toLowerCase().includes(termino)
      );
    }

    return lista;
  }

  /** Cuenta cuántas evidencias hay de un tipo (o el total si key === 'todos'), para el numerito de cada pastilla. */
  contarPorTipo(key: string): number {
    if (key === 'todos') return this.evidencias.length;
    return this.evidencias.filter(e => e.tipo === key).length;
  }

  onBuscar(event: Event) {
    this.terminoBusqueda = (event.target as HTMLInputElement).value;
  }

  setFiltro(key: string) {
    this.filtroActivo = key;
  }

  abrirModal(evidencia: Evidencia) {
    this.evidenciaSeleccionada = evidencia;
    this.modalAbierto = true;
  }

  cerrarModal() {
    this.modalAbierto = false;
    this.evidenciaSeleccionada = null;
  }

  getColor(tipo: string): string {
    const colores: Record<string, string> = {
      video: 'tipo-video',
      foto:  'tipo-foto',
      audio: 'tipo-audio',
    };
    return colores[tipo] || '';
  }

  get todoSincronizado(): boolean {
    return this.evidencias.length > 0 && this.evidencias.every(e => e.estado === 'En la nube');
  }

  get pendientesCount(): number {
    return this.evidencias.filter(e => e.estado === 'Pendiente').length;
  }

  /**
   * TODO: reemplazar por la llamada real a tu backend, ej.:
   *   this.evidenceService.sincronizar().subscribe(() => { ... })
   * Por ahora simula la sincronización: marca todo como "En la nube" después de 1.2s,
   * para que el botón y el banner respondan visualmente mientras conectas el endpoint real.
   */
  sincronizarAhora() {
    if (this.sincronizando) return;
    this.sincronizando = true;

    setTimeout(() => {
      this.evidencias = this.evidencias.map(e => ({ ...e, estado: 'En la nube' as const }));
      this.ultimaSincronizacion = new Date();
      this.sincronizando = false;
    }, 1200);
  }

  /** Texto tipo "hace 2 min" para el banner. */
  formatearUltimaSync(): string {
    if (!this.ultimaSincronizacion) return 'aún no sincronizado';

    const minutos = Math.round((Date.now() - this.ultimaSincronizacion.getTime()) / 60000);
    if (minutos < 1) return 'hace un momento';
    if (minutos === 1) return 'hace 1 min';
    return `hace ${minutos} min`;
  }
}