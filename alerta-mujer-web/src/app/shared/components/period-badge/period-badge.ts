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
  @Input() period = '';
  @Input() options: string[] = [];           // si viene vacío, no muestra dropdown (modo compacto)
  @Input() conDropdown = false;                 // true solo en el selector principal del header

  @Output() periodChange = new EventEmitter<string>();

  menuOpen = false;

  constructor(private elRef: ElementRef) {}

  toggleMenu() {
    if (this.conDropdown) {
      this.menuOpen = !this.menuOpen;
    }
  }

  select(p: string) {
    this.period = p;
    this.periodChange.emit(p);
    this.menuOpen = false;
  }

  // Cierra el dropdown si se hace click fuera del componente
  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.menuOpen = false;
    }
  }
}