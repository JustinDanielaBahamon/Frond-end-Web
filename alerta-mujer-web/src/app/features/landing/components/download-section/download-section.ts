import { TPipe } from '../../../../core/i18n/i18n';
import { Component } from '@angular/core';
import { APK_DOWNLOAD_URL } from '../../../../shared/constants/descarga-app';

@Component({
  selector: 'app-download-section',
  imports: [TPipe, ],
  templateUrl: './download-section.html',
  styleUrl: './download-section.scss',
})
export class DownloadSectionComponent {
  readonly apkUrl = APK_DOWNLOAD_URL;

  readonly steps = [
    { icon: 'fa-solid fa-download', text: 'Descarga el archivo AlertaMujer.apk en tu celular Android.' },
    { icon: 'fa-solid fa-shield-halved', text: 'Si tu celular lo pide, permite instalar apps desde tu navegador.' },
    { icon: 'fa-solid fa-user-check', text: 'Abre AlertaMujer, inicia sesión y sigue el tutorial de protección.' },
  ];
}
