import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-configuration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="config-page">
      <div class="config-section-header">
        <h2 class="config-section-title">Configurations</h2>
        <p class="config-section-sub">Manage integrations and account-level settings.</p>
      </div>

      <!-- Gemini integration card -->
      <div class="config-card">
        <div class="config-card-header">
          <div class="config-card-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div class="config-card-info">
            <span class="config-card-name">Google Gemini</span>
            <span class="config-card-desc">Powers the Renni AI log assistant</span>
          </div>
          <span class="config-status-badge"
                [class.config-status-badge--ok]="geminiConfigured"
                [class.config-status-badge--off]="!geminiConfigured">
            {{ geminiConfigured ? 'Connected' : 'Not set' }}
          </span>
        </div>

        <div class="config-card-body">
          <label class="config-field-label">Gemini API Key</label>
          <div class="config-key-row">
            <input
              class="config-key-input"
              [type]="showKey ? 'text' : 'password'"
              [(ngModel)]="apiKeyInput"
              placeholder="AIza..."
              autocomplete="off"
              spellcheck="false"
            />
            <button class="config-key-toggle" (click)="showKey = !showKey" type="button"
                    [title]="showKey ? 'Hide key' : 'Show key'">
              <svg *ngIf="!showKey" width="15" height="15" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <svg *ngIf="showKey" width="15" height="15" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
          </div>

          <p class="config-hint">
            Get your key from
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener"
               class="config-link">Google AI Studio</a>.
            The key is verified against Gemini before saving.
          </p>

          <div class="config-feedback config-feedback--error" *ngIf="errorMsg">{{ errorMsg }}</div>
          <div class="config-feedback config-feedback--ok"    *ngIf="successMsg">{{ successMsg }}</div>

          <div class="config-card-actions">
            <button class="config-save-btn"
                    (click)="saveKey()"
                    [disabled]="saving || !apiKeyInput.trim()">
              {{ saving ? 'Verifying…' : 'Save & Verify' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .config-page {
      padding: 24px 20px;
      max-width: 600px;
    }
    .config-section-header { margin-bottom: 20px; }
    .config-section-title  { font-size: 1.1rem; font-weight: 600; margin: 0 0 4px; }
    .config-section-sub    { font-size: 0.82rem; opacity: 0.6; margin: 0; }

    .config-card {
      background: var(--color-secondary, #1e2030);
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.07);
    }
    .config-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .config-card-icon {
      width: 36px; height: 36px;
      border-radius: 8px;
      background: rgba(255,255,255,0.07);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .config-card-info    { flex: 1; }
    .config-card-name    { display: block; font-size: 0.9rem; font-weight: 600; }
    .config-card-desc    { display: block; font-size: 0.76rem; opacity: 0.55; }

    .config-status-badge {
      font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em;
      padding: 3px 8px; border-radius: 12px;
    }
    .config-status-badge--ok  { background: rgba(74,222,128,0.15); color: #4ade80; }
    .config-status-badge--off { background: rgba(255,255,255,0.08); opacity: 0.55; }

    .config-card-body    { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .config-field-label  { font-size: 0.78rem; font-weight: 600; opacity: 0.65; }

    .config-key-row      { display: flex; gap: 6px; }
    .config-key-input {
      flex: 1; padding: 8px 10px;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 7px; color: inherit; font-size: 0.84rem;
      font-family: monospace;
    }
    .config-key-input:focus { outline: none; border-color: rgba(255,255,255,0.3); }
    .config-key-toggle {
      padding: 0 10px;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 7px; color: inherit; cursor: pointer;
      display: flex; align-items: center;
    }
    .config-key-toggle:hover { background: rgba(255,255,255,0.1); }

    .config-hint   { font-size: 0.76rem; opacity: 0.5; margin: 0; line-height: 1.5; }
    .config-link   { color: inherit; opacity: 0.8; }
    .config-link:hover { opacity: 1; }

    .config-feedback       { font-size: 0.8rem; padding: 8px 10px; border-radius: 6px; }
    .config-feedback--error { background: rgba(248,113,113,0.15); color: #f87171; }
    .config-feedback--ok    { background: rgba(74,222,128,0.12); color: #4ade80; }

    .config-card-actions { display: flex; justify-content: flex-end; }
    .config-save-btn {
      padding: 8px 18px; border-radius: 8px;
      background: var(--color-accent, #a78bfa);
      color: #fff; font-size: 0.84rem; font-weight: 600;
      border: none; cursor: pointer; transition: opacity 0.15s;
    }
    .config-save-btn:hover:not(:disabled) { opacity: 0.85; }
    .config-save-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  `]
})
export class ConfigurationComponent implements OnInit {
  geminiConfigured = false;
  apiKeyInput      = '';
  showKey          = false;
  saving           = false;
  errorMsg         = '';
  successMsg       = '';

  constructor(private configService: ConfigService) {}

  ngOnInit(): void {
    this.configService.getConfig().subscribe({
      next: cfg => { this.geminiConfigured = cfg.geminiConfigured; },
      error: () => {}
    });
  }

  saveKey(): void {
    if (this.saving || !this.apiKeyInput.trim()) return;
    this.saving     = true;
    this.errorMsg   = '';
    this.successMsg = '';
    this.configService.saveGeminiKey(this.apiKeyInput.trim()).subscribe({
      next: res => {
        this.saving           = false;
        this.geminiConfigured = true;
        this.successMsg       = res.message;
        this.apiKeyInput      = '';
      },
      error: err => {
        this.saving   = false;
        this.errorMsg = err.error?.error || 'Failed to verify API key.';
      }
    });
  }
}
