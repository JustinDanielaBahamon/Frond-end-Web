import { TPipe } from '../../../core/i18n/i18n';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chip',
  standalone: true,
  imports: [TPipe, CommonModule],
  templateUrl: './chip.html',
  styleUrl: './chip.scss'
})
export class Chip {
  @Input() label = '';
  @Input() active = false;
  @Input() dotColor?: string;   // optional: if not given, the color dot is not shown
  @Input() count?: number;       // optional: if not given, the counter is not shown

  @Output() chipClick = new EventEmitter<void>();
}