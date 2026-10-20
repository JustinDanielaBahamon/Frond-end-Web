import { Component } from '@angular/core';
import { URL_DESCARGA_APK } from '../../../../shared/constants/descarga-app';

@Component({
  selector: 'app-download-section',
  imports: [],
  templateUrl: './download-section.html',
  styleUrl: './download-section.scss',
})
export class DownloadSectionComponent {
  readonly urlApk = URL_DESCARGA_APK;

  readonly pasos = [
    { icono: 'fa-solid fa-download', texto: 'Descarga el archivo AlertaMujer.apk en tu celular Android.' },
    { icono: 'fa-solid fa-shield-halved', texto: 'Si tu celular lo pide, permite instalar apps desde tu navegador.' },
    { icono: 'fa-solid fa-user-check', texto: 'Abre AlertaMujer, inicia sesión y sigue el tutorial de protección.' },
  ];
}
