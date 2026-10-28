import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LocationTabsComponent } from '../../../shared/components/location-tabs/location-tabs';

@Component({
  selector: 'app-location-shell',
  standalone: true,
  imports: [RouterOutlet, LocationTabsComponent],
  template: `
    <app-location-tabs></app-location-tabs>
    <router-outlet></router-outlet>
  `,
})
export class LocationShellComponent {}
