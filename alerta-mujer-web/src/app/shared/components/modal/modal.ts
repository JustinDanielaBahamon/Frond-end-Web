import { TPipe } from '../../../core/i18n/i18n';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [TPipe, CommonModule],
  templateUrl: './modal.html',
  styleUrl: './modal.scss'
})
export class Modal {
  @Input() title = '';
  @Input() size: 'sm' | 'md' | 'lg' | 'zona' = 'md';
  @Input() variant: 'default' | 'danger' = 'default';
  @Input() closeOnClickOutside = true;

  @Output() close = new EventEmitter<void>();

  onOverlayClick() {
    if (this.closeOnClickOutside) {
      this.close.emit();
    }
  }
}