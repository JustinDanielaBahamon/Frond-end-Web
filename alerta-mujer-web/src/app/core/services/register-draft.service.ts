import { Injectable } from '@angular/core';

/*
 * Temporarily keeps the registration form state
 *   while the user reads the Terms or the Privacy Policy.
 *   It lives only in memory: reloading the page loses it.
 */
@Injectable({ providedIn: 'root' })
export class RegisterDraftService {

  /* What the user already typed in the form */
  values: any = null;

  /* Whether she already opened each text (allows checking the box) */
  termsRead = false;
  privacyRead = false;

  /* Checkbox state */
  acceptsTerms = false;
  acceptsPrivacy = false;

  /* Called when the registration finishes successfully */
  clear(): void {
    this.values = null;
    this.termsRead = false;
    this.privacyRead = false;
    this.acceptsTerms = false;
    this.acceptsPrivacy = false;
  }
}