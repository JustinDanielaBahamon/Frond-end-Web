import { Component, computed, input } from '@angular/core';
import { evaluatePassword } from '../../../core/services/password.service';

/** Barra de seguridad y requisitos de una contraseña nueva. */
@Component({
  selector: 'app-password-strength',
  standalone: true,
  template: `
    @if (key()) {
      <div class="ps-bar" [attr.data-nivel]="ev().level" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </div>
      <p class="ps-label">Seguridad: <strong>{{ ev().label }}</strong></p>
    }
    <ul class="ps-reqs">
      @for (r of ev().requirements; track r.text) {
        <li [class.ok]="r.meets"><i class="ti" [class.ti-circle-check]="r.meets" [class.ti-circle]="!r.meets"></i>{{ r.text }}</li>
      }
    </ul>
  `,
  styles: `
    :host { display: block; }
    .ps-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 4px; }
    .ps-bar span { height: 6px; border-radius: 99px; background: var(--border, #e4dcf7); transition: background .2s; }
    .ps-bar[data-nivel="1"] span:nth-child(-n+1) { background: #e9d5ff; }
    .ps-bar[data-nivel="2"] span:nth-child(-n+2) { background: #c084fc; }
    .ps-bar[data-nivel="3"] span:nth-child(-n+3) { background: #a855f7; }
    .ps-bar[data-nivel="4"] span { background: linear-gradient(90deg, #a855f7, #7c3aed); box-shadow: 0 0 8px rgba(168, 85, 247, .55); }
    .ps-label { margin: 6px 0 0; font-size: 12.5px; color: var(--text-muted, #6b5b95); }
    .ps-label strong { color: var(--purple-deep, #7c3aed); }
    .ps-reqs { list-style: none; margin: 8px 0 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; }
    .ps-reqs li { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--text-muted, #6b5b95); }
    .ps-reqs li.ok { color: var(--purple-deep, #7c3aed); font-weight: 600; }
    @media (max-width: 480px) { .ps-reqs { grid-template-columns: 1fr; } }
  `,
})
export class PasswordStrengthComponent {
  readonly key = input<string>('');
  readonly ev = computed(() => evaluatePassword(this.key()));
}
