import { Component, Input, Output, EventEmitter, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-period-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './period-badge.html',
  styleUrl: './period-badge.scss'
})
export class PeriodBadge {
  @Input() periodo = '';
  @Input() opciones: string[] = [];           // si viene vacío, no muestra dropdown (modo compacto)
  @Input() conDropdown = false;                 // true solo en el selector principal del header

  @Output() periodoChange = new EventEmitter<string>();

  menuAbierto = false;

  constructor(private elRef: ElementRef) {}

  toggleMenu() {
    if (this.conDropdown) {
      this.menuAbierto = !this.menuAbierto;
    }
  }

  seleccionar(p: string) {
    this.periodo = p;
    this.periodoChange.emit(p);
    this.menuAbierto = false;
  }

  // Cierra el dropdown si se hace click fuera del componente
  @HostListener('document:click', ['$event'])
  onClickFuera(event: MouseEvent) {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.menuAbierto = false;
    }
  }
}