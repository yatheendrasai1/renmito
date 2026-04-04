import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-page">

      <!-- Card -->
      <div class="login-card">

        <!-- Logo -->
        <div class="login-logo">
          <svg width="36" height="36" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <circle cx="14" cy="14" r="12" stroke="rgba(255,255,255,0.9)" stroke-width="2"/>
            <path d="M14 8v6l4 3" stroke="rgba(255,255,255,0.9)" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="14" cy="14" r="2" fill="rgba(255,255,255,0.7)"/>
          </svg>
          <span class="login-app-name">Renmito</span>
        </div>

        <p class="login-tagline">Track your time. Own your day.</p>

        <!-- Tab switcher -->
        <div class="login-tabs">
          <button class="login-tab" [class.login-tab--active]="mode === 'login'"
                  (click)="switchMode('login')">Log In</button>
          <button class="login-tab" [class.login-tab--active]="mode === 'signup'"
                  (click)="switchMode('signup')">Sign Up</button>
        </div>

        <!-- Error banner -->
        <div class="login-error" *ngIf="errorMsg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {{ errorMsg }}
        </div>

        <!-- Form -->
        <form class="login-form" (ngSubmit)="submit()" #loginForm="ngForm" novalidate>

          <!-- Username — signup only -->
          <div class="form-field" *ngIf="mode === 'signup'">
            <label for="userName">Username</label>
            <input id="userName" type="text" name="userName"
                   [(ngModel)]="userName" placeholder="e.g. john_doe"
                   autocomplete="username" required [disabled]="loading"/>
          </div>

          <!-- Email -->
          <div class="form-field">
            <label for="email">Email</label>
            <input id="email" type="email" name="email"
                   [(ngModel)]="email" placeholder="you@example.com"
                   autocomplete="email" required [disabled]="loading"/>
          </div>

          <!-- Password -->
          <div class="form-field">
            <label for="password">Password</label>
            <div class="password-wrap">
              <input [type]="showPassword ? 'text' : 'password'" id="password" name="password"
                     [(ngModel)]="password" placeholder="••••••••"
                     autocomplete="current-password" required [disabled]="loading"
                     (keydown.enter)="submit()"/>
              <button type="button" class="show-pw-btn" (click)="showPassword = !showPassword"
                      [title]="showPassword ? 'Hide password' : 'Show password'">
                <!-- Eye open -->
                <svg *ngIf="!showPassword" width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <!-- Eye off -->
                <svg *ngIf="showPassword" width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Submit -->
          <button type="submit" class="login-submit"
                  [disabled]="loading || !email || !password || (mode === 'signup' && !userName)">
            <span class="btn-spinner" *ngIf="loading"></span>
            <span *ngIf="!loading">{{ mode === 'login' ? 'Log In' : 'Create Account' }}</span>
            <span *ngIf="loading">{{ mode === 'login' ? 'Logging in…' : 'Creating account…' }}</span>
          </button>

        </form>

        <!-- Footer switch -->
        <p class="login-switch">
          <ng-container *ngIf="mode === 'login'">
            Don't have an account?
            <button class="login-switch-btn" (click)="switchMode('signup')">Sign up</button>
          </ng-container>
          <ng-container *ngIf="mode === 'signup'">
            Already have an account?
            <button class="login-switch-btn" (click)="switchMode('login')">Log in</button>
          </ng-container>
        </p>

      </div><!-- /card -->
    </div><!-- /page -->
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-primary);
      padding: 24px;
    }

    .login-card {
      width: 100%;
      max-width: 400px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 36px 32px 28px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.35);
    }

    /* Logo */
    .login-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: var(--header-bg);
      border-radius: 10px;
      padding: 14px 20px;
    }
    .login-app-name {
      font-size: 22px;
      font-weight: 700;
      color: var(--header-text);
      letter-spacing: -0.4px;
    }

    .login-tagline {
      margin: 0;
      font-size: 12px;
      color: var(--text-muted);
      text-align: center;
      letter-spacing: 0.3px;
    }

    /* Tabs */
    .login-tabs {
      display: flex;
      background: var(--bg-surface);
      border-radius: 8px;
      padding: 3px;
      gap: 3px;
    }
    .login-tab {
      flex: 1;
      padding: 8px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 6px;
      color: var(--text-muted);
      background: transparent;
      transition: background 0.15s, color 0.15s;
    }
    .login-tab--active {
      background: var(--bg-card);
      color: var(--text-primary);
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    }
    .login-tab:hover:not(.login-tab--active) {
      color: var(--text-secondary);
    }

    /* Error */
    .login-error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: rgba(239,83,80,0.12);
      border: 1px solid rgba(239,83,80,0.35);
      border-radius: 8px;
      font-size: 12px;
      color: #ef5350;
    }

    /* Form */
    .login-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .form-field label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .form-field input {
      width: 100%;
      padding: 10px 12px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 14px;
      transition: border-color 0.15s, box-shadow 0.15s;
      box-sizing: border-box;
    }
    .form-field input:focus {
      outline: none;
      border-color: var(--highlight-selected);
      box-shadow: 0 0 0 3px rgba(74,144,226,0.15);
    }
    .form-field input::placeholder { color: var(--text-muted); }
    .form-field input:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Password wrap */
    .password-wrap {
      position: relative;
    }
    .password-wrap input { padding-right: 40px; }
    .show-pw-btn {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      color: var(--text-muted);
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }
    .show-pw-btn:hover { color: var(--text-primary); }

    /* Submit */
    .login-submit {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 11px;
      margin-top: 4px;
      background: #e94f37;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      border-radius: 8px;
      transition: background 0.2s, opacity 0.2s;
    }
    .login-submit:hover:not(:disabled) { background: #d43d27; }
    .login-submit:disabled { opacity: 0.45; cursor: not-allowed; }

    .btn-spinner {
      width: 15px;
      height: 15px;
      border: 2px solid rgba(255,255,255,0.35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Footer */
    .login-switch {
      margin: 0;
      font-size: 12px;
      color: var(--text-muted);
      text-align: center;
    }
    .login-switch-btn {
      background: none;
      color: var(--highlight-selected);
      font-size: 12px;
      font-weight: 600;
      text-decoration: underline;
      text-underline-offset: 2px;
      margin-left: 4px;
    }
    .login-switch-btn:hover { color: #3a7fcf; }

    @media (max-width: 480px) {
      .login-card { padding: 28px 20px 22px; }
    }
  `]
})
export class LoginComponent {
  @Output() loggedIn = new EventEmitter<void>();

  mode: 'login' | 'signup' = 'login';

  userName  = '';
  email     = '';
  password  = '';
  showPassword = false;
  loading   = false;
  errorMsg  = '';

  constructor(private authService: AuthService) {}

  switchMode(m: 'login' | 'signup'): void {
    this.mode     = m;
    this.errorMsg = '';
    this.password = '';
  }

  submit(): void {
    if (this.loading) return;
    this.errorMsg = '';

    if (!this.email || !this.password || (this.mode === 'signup' && !this.userName)) return;

    this.loading = true;
    const req$ = this.mode === 'login'
      ? this.authService.login(this.email, this.password)
      : this.authService.signup(this.userName, this.email, this.password);

    req$.subscribe({
      next: () => {
        this.loading = false;
        this.loggedIn.emit();
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err?.error?.error ?? 'Something went wrong. Please try again.';
      }
    });
  }
}
