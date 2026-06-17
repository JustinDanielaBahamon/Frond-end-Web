import { Component } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, NgClass, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home{

  chartData = [
    { mes: 'J', valor: 15 },
    { mes: 'F', valor: 18 },
    { mes: 'M', valor: 22 },
    { mes: 'A', valor: 25 },
    { mes: 'M', valor: 20 },
    { mes: 'J', valor: 10 },
    { mes: 'J', valor: 12 },
    { mes: 'A', valor: 20 },
    { mes: 'S', valor: 18 },
    { mes: 'O', valor: 22 },
    { mes: 'N', valor: 14 },
    { mes: 'D', valor: 9 },
  ];

  yAxis = [30, 25, 20, 15, 10, 5, 0];

  actividad = [
    { n: 1, tipo: 'SOS',              ubicacion: 'Cra 7 #34-12',   fecha: 'Hoy 10:32 AM',   estado: 'VALIDADA' },
    { n: 2, tipo: 'Perímetro check',  ubicacion: 'Calle 12 #45-67', fecha: 'Hoy 09:15 AM',   estado: 'OK' },
    { n: 3, tipo: 'Ubicación manual', ubicacion: 'Parque Central',  fecha: 'Ayer 14:27 PM',  estado: 'OK' },
    { n: 4, tipo: 'Contacto agregado',ubicacion: 'N/A',             fecha: 'Ayer 11:03 AM',  estado: 'OK' },
    { n: 5, tipo: 'Check-in diario',  ubicacion: 'N/A',             fecha: 'Lunes 18:45 PM', estado: 'OK' },
  ];
}