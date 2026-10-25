import { Injectable } from '@angular/core';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, signInWithPopup, signOut } from 'firebase/auth';
import { environment } from '../../../environments/environment';

/**
 * Opens the Google window (Firebase Authentication) and returns the Firebase ID token.
 * That token is sent to the backend (/api/auth/google), which validates it and returns the app JWT.
 * The app session is the backend one: the Firebase one is closed right away.
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
