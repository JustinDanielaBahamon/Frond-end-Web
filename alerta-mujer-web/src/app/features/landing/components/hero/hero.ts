import { TPipe } from '../../../../core/i18n/i18n';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-hero',
  standalone:true,
  imports: [TPipe, RouterLink],
  templateUrl: './hero.html',
  styleUrl: './hero.scss',
})
export class heroComponent {}
