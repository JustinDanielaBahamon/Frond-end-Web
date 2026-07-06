import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chip.html',
  styleUrl: './chip.scss'
})
export class Chip {
  @Input() label = '';
  @Input() active = false;
  @Input() dotColor?: string;   // opcional: si no viene, no muestra el punto de color
  @Input() count?: number;       // opcional: si no viene, no muestra el contador

  @Output() chipClick = new EventEmitter<void>();
}