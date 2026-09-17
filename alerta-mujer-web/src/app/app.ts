import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AccentColorService } from './core/theme/accent-color.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly accentColorService = inject(AccentColorService); // fuerza su creación al arrancar
}