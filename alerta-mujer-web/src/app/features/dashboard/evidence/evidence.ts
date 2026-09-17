import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { EvidenceService } from '../../../core/services/evidence.service';
import { Evidencia } from '../../../core/models/evidence.model';
import { AuthService } from '../../../core/auth/auth.service';

type FiltroTipo = 'todos' | 'foto' | 'video' | 'audio';
type Orden = 'recientes' | 'antiguas';

@Component({
  selector: 'app-evidence',
  standalone: true,
  imports: [CommonModule, NgClass],
  templateUrl: './evidence.html',
  styleUrl: './evidence.scss',
})
export class Evidence implements OnInit {
  private evidenceService = inject(EvidenceService);
  private authService = inject(AuthService);

  loading = true;
  error = false;

  tabs: { key: FiltroTipo; label: string }[] = [
    { key: 'todos', label: 'Todas' },
    { key: 'foto',  label: 'Fotos' },
    { key: 'video', label: 'Videos' },
    { key: 'audio', label: 'Audios' },
  ];
  filtroActivo: FiltroTipo = 'todos';

  terminoBusqueda = '';
  orden: Orden = 'recientes';

  evidencias: Evidencia[] = [];
  evidenciaSeleccionada: Evidencia | null = null;

  lightboxAbierto = false;

  ngOnInit() {
    this.authService.currentUser$.subscribe((usuario) => {
      if (!usuario) { this.error = true; this.loading = false; return; }

      this.loading = true;
      this.evidenceService.getByUsuario(usuario.id).subscribe({
        next: (data) => {
          this.evidencias = data;
          this.loading = false;
          // Selecciona la más reciente por defecto, para que el panel de
          // detalle no arranque vacío (como en el diseño de referencia).
          if (data.length > 0 && !this.evidenciaSeleccionada) {
            this.evidenciaSeleccionada = this.ordenarPorFecha(data, 'recientes')[0];
          }
        },
        error: () => { this.error = true; this.loading = false; },
      });
    });
  }

  setFiltro(key: FiltroTipo) { this.filtroActivo = key; }

  onBuscar(event: Event) {
    this.terminoBusqueda = (event.target as HTMLInputElement).value;
  }

  onOrdenChange(event: Event) {
    this.orden = (event.target as HTMLSelectElement).value as Orden;
  }

  contarPorTipo(key: FiltroTipo): number {
    if (key === 'todos') return this.evidencias.length;
    return this.evidencias.filter(e => e.tipo === key).length;
  }

  get evidenciasFiltradas(): Evidencia[] {
    let lista = this.filtroActivo === 'todos'
      ? this.evidencias
      : this.evidencias.filter(e => e.tipo === this.filtroActivo);

    const termino = this.terminoBusqueda.trim().toLowerCase();
    if (termino) {
      lista = lista.filter(e =>
        e.nombre.toLowerCase().includes(termino) ||
        e.alerta.toLowerCase().includes(termino) ||
        (e.ubicacion ?? '').toLowerCase().includes(termino)
      );
    }

    return this.ordenarPorFecha(lista, this.orden);
  }

  private ordenarPorFecha(lista: Evidencia[], orden: Orden): Evidencia[] {
    return [...lista].sort((a, b) => {
      const fa = new Date(a.fecha).getTime();
      const fb = new Date(b.fecha).getTime();
      const va = isNaN(fa) ? 0 : fa;
      const vb = isNaN(fb) ? 0 : fb;
      return orden === 'recientes' ? vb - va : va - vb;
    });
  }

  /** Otras evidencias de la misma emergencia, para el carrusel del panel de detalle. */
  get relacionadas(): Evidencia[] {
    if (!this.evidenciaSeleccionada) return [];
    return this.evidencias.filter(e => e.alerta === this.evidenciaSeleccionada!.alerta);
  }

  seleccionar(e: Evidencia) {
    this.evidenciaSeleccionada = e;
  }

  cerrarDetalle() {
    this.evidenciaSeleccionada = null;
  }

  abrirLightbox() { this.lightboxAbierto = true; }
  cerrarLightbox() { this.lightboxAbierto = false; }

  getColor(tipo: string): string {
    const colores: Record<string, string> = {
      video: 'tipo-video',
      foto:  'tipo-foto',
      audio: 'tipo-audio',
    };
    return colores[tipo] || '';
  }

  tipoLabel(tipo: string): string {
    const labels: Record<string, string> = {
      video: 'Video',
      foto: 'Fotografía',
      audio: 'Audio',
    };
    return labels[tipo] || tipo;
  }

  /** '2026-08-28T20:45:00' -> '28 ago. 2026'. Si no parsea, muestra el texto tal cual llegó. */
  formatFecha(fecha: string): string {
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return fecha;
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /** '2026-08-28T20:45:00' -> '8:45 PM'. Vacío si no parsea. */
  formatHora(fecha: string): string {
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  /** '2026-08-28T20:45:00' -> '28 de agosto de 2026' (para el panel de detalle). */
  formatFechaLarga(fecha: string): string {
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return fecha;
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // TODO: conectar con el endpoint real de descarga cuando exista, ej.:
  //   this.evidenceService.descargar(evidencia.id).subscribe(...)
  descargar() {
    if (!this.evidenciaSeleccionada?.archivoUrl) return;
    window.open(this.evidenciaSeleccionada.archivoUrl, '_blank');
  }
}