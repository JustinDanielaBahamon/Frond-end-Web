import { Injectable, signal } from '@angular/core';

/**
 * Data of the "forgot my password" flow between screens (email → code → new password).
 * In memory only: reloading the page starts over.
 */
@Injectable({ providedIn: 'root' })
export class RecoveryStateService {
  readonly email = signal<string | null>(null);
  readonly code = signal<string | null>(null);

  clear(): void {
    this.email.set(null);
    this.code.set(null);
  }
}
