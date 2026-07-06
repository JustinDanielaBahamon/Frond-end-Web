import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal.html',
  styleUrl: './modal.scss'
})
export class Modal {
  @Input() titulo = '';
  @Input() tamano: 'sm' | 'md' | 'lg' | 'zona' = 'md';
  @Input() variante: 'default' | 'danger' = 'default';
  @Input() cerrarAlClickFuera = true;

  @Output() cerrar = new EventEmitter<void>();

  onOverlayClick() {
    if (this.cerrarAlClickFuera) {
      this.cerrar.emit();
    }
  }
}