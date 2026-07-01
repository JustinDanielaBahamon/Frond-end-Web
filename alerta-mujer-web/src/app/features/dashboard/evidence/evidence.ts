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
  cargando = true;
  error = false;

  evidenciaSeleccionada: Evidencia | null = null;
  modalAbierto = false;

  ngOnInit() {
    this.authService.currentUser$.subscribe((usuario) => {
      if (!usuario) {
        this.error = true;
        this.cargando = false;
        return;
      }

      this.evidenceService.getByUsuario(usuario.id).subscribe({
        next: (data) => {
          this.evidencias = data;
          this.cargando = false;
        },
        error: () => {
          this.error = true;
          this.cargando = false;
        },
      });
    });
  }

  get evidenciasFiltradas(): Evidencia[] {
    if (this.filtroActivo === 'todos') return this.evidencias;
    return this.evidencias.filter(e => e.tipo === this.filtroActivo);
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

  getIcono(tipo: string): string {
    const iconos: Record<string, string> = {
      video: 'ti-video',
      foto:  'ti-camera',
      audio: 'ti-microphone',
    };
    return iconos[tipo] || 'ti-file';
  }

  getColor(tipo: string): string {
    const colores: Record<string, string> = {
      video: 'tipo-video',
      foto:  'tipo-foto',
      audio: 'tipo-audio',
    };
    return colores[tipo] || '';
  }
}