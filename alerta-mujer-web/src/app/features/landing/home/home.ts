import { TPipe } from '../../../core/i18n/i18n';
import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [TPipe, ],
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
})
export class LandingHomeComponent {}