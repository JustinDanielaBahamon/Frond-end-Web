import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './card.html',
  styleUrl: './card.scss',
  host: { class: 'card' },
  encapsulation: ViewEncapsulation.None  // ← agrega esto
})
export class CardComponent {}