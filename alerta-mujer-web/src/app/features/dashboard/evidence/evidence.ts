import { Component } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';

@Component({
  selector: 'app-evidence',
  imports: [CommonModule, NgClass],
  templateUrl: './evidence.html',
  styleUrl: './evidence.scss',
})
export class Evidence {
  filtroActivo = 'todos';

  filtros = [
    { key: 'todos',  label: 'Todos' },
    { key: 'video',  label: 'Video' },
    { key: 'foto',   label: 'Foto' },
    { key: 'audio',  label: 'Audio' },
  ];

  evidencias = [
  { id: 1, tipo: 'video', nombre: 'Video_alerta_024.mp4', tamanio: '15.3 MB', fecha: '13 jun 2026', alerta: '#024', estado: 'En la nube' },
  { id: 2, tipo: 'foto',  nombre: 'Foto_alerta_024.jpg',  tamanio: '58.9 MB', fecha: '13 jun 2026', alerta: '#024', estado: 'En la nube' },
  { id: 3, tipo: 'audio', nombre: 'Audio_alerta_024.mp3', tamanio: '19.9 MB', fecha: '13 jun 2026', alerta: '#024', estado: 'En la nube' },
  { id: 4, tipo: 'video', nombre: 'Video_alerta_023.mp4', tamanio: '39.2 MB', fecha: '12 jun 2026', alerta: '#023', estado: 'En la nube' },
  { id: 5, tipo: 'foto',  nombre: 'Foto_alerta_023.jpg',  tamanio: '58.7 MB', fecha: '12 jun 2026', alerta: '#023', estado: 'Pendiente' },
  { id: 6, tipo: 'audio', nombre: 'Audio_alerta_023.mp3', tamanio: '29.7 MB', fecha: '12 jun 2026', alerta: '#023', estado: 'En la nube' },
  { id: 7, tipo: 'video', nombre: 'Video_alerta_022.mp4', tamanio: '22.1 MB', fecha: '10 jun 2026', alerta: '#022', estado: 'En la nube' },
  { id: 8, tipo: 'foto',  nombre: 'Foto_alerta_022.jpg',  tamanio: '44.3 MB', fecha: '10 jun 2026', alerta: '#022', estado: 'En la nube' },
  { id: 9, tipo: 'audio', nombre: 'Audio_alerta_022.mp3', tamanio: '18.5 MB', fecha: '10 jun 2026', alerta: '#022', estado: 'Pendiente' },
];

  evidenciaSeleccionada: any = null;
  modalAbierto = false;

  get evidenciasFiltradas() {
    if (this.filtroActivo === 'todos') return this.evidencias;
    return this.evidencias.filter(e => e.tipo === this.filtroActivo);
  }

  setFiltro(key: string) {
    this.filtroActivo = key;
  }

  abrirModal(evidencia: any) {
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
