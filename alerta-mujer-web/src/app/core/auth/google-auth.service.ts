import { Injectable } from '@angular/core';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, signInWithPopup, signOut } from 'firebase/auth';
import { environment } from '../../../environments/environment';

/**
 * Abre la ventana de Google (Firebase Authentication) y devuelve el ID token de Firebase.
 * Ese token se envía al backend (/api/auth/google), que lo valida y entrega el JWT de la app.
 * La sesión de la app es la del backend: la de Firebase se cierra enseguida.
 */
@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  get configured(): boolean {
    return !!environment.firebase?.apiKey;
  }

  async getIdToken(): Promise<string> {
    if (!this.configured) {
      throw new Error('El inicio de sesión con Google no está configurado.');
    }
    const auth = getAuth(this.app());
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();
    await signOut(auth);
    return idToken;
  }

  private app(): FirebaseApp {
    return getApps().length ? getApp() : initializeApp(environment.firebase);
  }
}
