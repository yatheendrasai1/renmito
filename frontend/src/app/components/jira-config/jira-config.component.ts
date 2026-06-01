import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { JiraService, JiraConfig } from '../../services/jira.service';

@Component({
  selector: 'app-jira-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="jira-page">
      <div class="jira-page-header">
        <div class="jira-page-header-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M9 9h6M9 12h6M9 15h4"/>
          </svg>
        </div>
        <div>
          <h2 class="jira-page-title">JIRA Integration</h2>
          <p class="jira-page-sub">Connect your Atlassian account to link work logs to JIRA tickets.</p>
        </div>
      </div>

      <!-- ── Connection status banner ── -->
      <div class="jira-status-banner" [class.jira-status-banner--connected]="isConnected" *ngIf="!loading">
        <span class="jira-status-dot" [class.jira-status-dot--on]="isConnected"></span>
        <span class="jira-status-text">
          {{ isConnected ? ('Connected as ' + connectedAs) : 'Not connected' }}
        </span>
        <button class="jira-status-remove" *ngIf="isConnected" (click)="removeConfig()"
                [disabled]="saving || testing" title="Disconnect JIRA">
          Disconnect
        </button>
      </div>

      <!-- ── Loading skeleton ── -->
      <div class="jira-skeleton" *ngIf="loading">
        <div class="jira-sk-line jira-sk-line--wide"></div>
        <div class="jira-sk-line"></div>
        <div class="jira-sk-line"></div>
      </div>

      <!-- ── Credentials form ── -->
      <div class="jira-form" *ngIf="!loading">
        <div class="jira-field">
          <label class="jira-label">JIRA Base URL</label>
          <input class="jira-input" type="url"
                 placeholder="https://yourcompany.atlassian.net"
                 [(ngModel)]="draft.baseUrl"
                 [disabled]="saving"/>
          <span class="jira-hint">Your Atlassian workspace URL — visible in the browser when on any JIRA page.</span>
        </div>

        <div class="jira-field">
          <label class="jira-label">Atlassian Email</label>
          <input class="jira-input" type="email"
                 placeholder="you@company.com"
                 [(ngModel)]="draft.email"
                 [disabled]="saving"/>
        </div>

        <div class="jira-field">
          <label class="jira-label">API Token</label>
          <div class="jira-token-row">
            <input class="jira-input"
                   [type]="showToken ? 'text' : 'password'"
                   [placeholder]="isConnected ? '••••••••  (leave blank to keep current)' : 'Paste your API token'"
                   [(ngModel)]="draft.apiToken"
                   [disabled]="saving"/>
            <button class="jira-token-toggle" type="button"
                    (click)="showToken = !showToken"
                    [title]="showToken ? 'Hide' : 'Show'">
              <svg *ngIf="!showToken" width="15" height="15" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <svg *ngIf="showToken" width="15" height="15" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
          </div>
          <span class="jira-hint">
            Generate at
            <a class="jira-link" href="https://id.atlassian.com/manage-profile/security/api-tokens"
               target="_blank" rel="noopener">id.atlassian.com → Security → API tokens</a>.
            Copy it immediately — it's shown only once.
          </span>
        </div>

        <!-- feedback -->
        <div class="jira-feedback jira-feedback--error" *ngIf="errorMsg">{{ errorMsg }}</div>
        <div class="jira-feedback jira-feedback--ok"    *ngIf="successMsg">{{ successMsg }}</div>

        <!-- actions -->
        <div class="jira-actions">
          <button class="jira-btn jira-btn--test"
                  (click)="testConnection()"
                  [disabled]="saving || testing || !isConnected">
            <span class="jira-spinner" *ngIf="testing"></span>
            <svg *ngIf="!testing" width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {{ testing ? 'Testing…' : 'Test Connection' }}
          </button>
          <button class="jira-btn jira-btn--save"
                  (click)="saveConfig()"
                  [disabled]="saving || testing || !canSave">
            <span class="jira-spinner" *ngIf="saving"></span>
            {{ saving ? 'Saving…' : (isConnected ? 'Update' : 'Save & Connect') }}
          </button>
        </div>
      </div>

      <!-- ── How-to steps ── -->
      <div class="jira-howto">
        <div class="jira-howto-title">How to get your API token</div>
        <ol class="jira-howto-steps">
          <li>Go to <a class="jira-link" href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener">id.atlassian.com → Security → API tokens</a></li>
          <li>Click <strong>Create API token</strong>, give it a name (e.g. "Renmito")</li>
          <li>Copy the token immediately — it won't be shown again</li>
          <li>Paste it in the field above along with your workspace URL and email</li>
        </ol>
      </div>
    </div>
  `,
  styles: [`
    .jira-page {
      padding: 20px 16px 40px;
      max-width: 560px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* ── Header ── */
    .jira-page-header {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 4px;
    }
    .jira-page-header-icon {
      width: 42px; height: 42px;
      border-radius: 10px;
      background: rgba(38,132,255,0.14);
      color: #2684ff;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .jira-page-title { font-size: 1.05rem; font-weight: 700; margin: 0 0 3px; color: var(--text-primary, #E0E4F0); }
    .jira-page-sub   { font-size: 0.8rem; margin: 0; color: var(--text-muted, #6A7290); line-height: 1.5; }

    /* ── Status banner ── */
    .jira-status-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid var(--border-light, rgba(255,255,255,0.08));
      background: var(--bg-card, rgba(255,255,255,0.04));
      font-size: 0.83rem;
    }
    .jira-status-banner--connected {
      border-color: rgba(74,222,128,0.25);
      background: rgba(74,222,128,0.06);
    }
    .jira-status-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--text-muted, #6A7290);
      flex-shrink: 0;
    }
    .jira-status-dot--on { background: #4ade80; box-shadow: 0 0 6px rgba(74,222,128,0.5); }
    .jira-status-text { flex: 1; color: var(--text-secondary, #8090A8); }
    .jira-status-banner--connected .jira-status-text { color: #4ade80; }
    .jira-status-remove {
      padding: 3px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;
      background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.25);
      color: #f87171; cursor: pointer;
      transition: background 0.12s;
    }
    .jira-status-remove:hover:not(:disabled) { background: rgba(248,113,113,0.2); }
    .jira-status-remove:disabled { opacity: 0.45; cursor: not-allowed; }

    /* ── Skeleton ── */
    .jira-skeleton { display: flex; flex-direction: column; gap: 10px; }
    .jira-sk-line {
      height: 36px; border-radius: 7px;
      background: linear-gradient(90deg, var(--bg-card, rgba(255,255,255,0.04)) 25%, var(--bg-surface, rgba(255,255,255,0.08)) 50%, var(--bg-card, rgba(255,255,255,0.04)) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    .jira-sk-line--wide { height: 44px; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* ── Form ── */
    .jira-form {
      display: flex; flex-direction: column; gap: 14px;
      padding: 18px;
      border-radius: 12px;
      border: 1px solid var(--border-light, rgba(255,255,255,0.08));
      background: var(--bg-card, rgba(255,255,255,0.04));
    }
    .jira-field { display: flex; flex-direction: column; gap: 5px; }
    .jira-label { font-size: 0.76rem; font-weight: 600; color: var(--text-secondary, #8090A8); text-transform: uppercase; letter-spacing: 0.05em; }
    .jira-input {
      padding: 9px 11px;
      background: var(--bg-surface, rgba(255,255,255,0.06));
      border: 1px solid var(--border-light, rgba(255,255,255,0.1));
      border-radius: 8px; color: var(--text-primary, #E0E4F0);
      font-size: 0.88rem; font-family: inherit;
      transition: border-color 0.15s;
      width: 100%; box-sizing: border-box;
    }
    .jira-input:focus { outline: none; border-color: rgba(38,132,255,0.5); }
    .jira-input:disabled { opacity: 0.5; }
    .jira-token-row { display: flex; gap: 6px; }
    .jira-token-row .jira-input { flex: 1; }
    .jira-token-toggle {
      padding: 0 12px; border-radius: 8px;
      background: var(--bg-surface, rgba(255,255,255,0.06));
      border: 1px solid var(--border-light, rgba(255,255,255,0.1));
      color: var(--text-muted, #6A7290); cursor: pointer; flex-shrink: 0;
      display: flex; align-items: center;
      transition: background 0.12s;
    }
    .jira-token-toggle:hover { background: var(--bg-card, rgba(255,255,255,0.1)); color: var(--text-primary, #E0E4F0); }
    .jira-hint { font-size: 0.74rem; color: var(--text-muted, #6A7290); line-height: 1.5; }
    .jira-link { color: #2684ff; text-decoration: none; }
    .jira-link:hover { text-decoration: underline; }

    /* ── Feedback ── */
    .jira-feedback { font-size: 0.79rem; padding: 8px 11px; border-radius: 7px; line-height: 1.45; }
    .jira-feedback--error { background: rgba(248,113,113,0.12); color: #f87171; }
    .jira-feedback--ok    { background: rgba(74,222,128,0.1);  color: #4ade80; }

    /* ── Actions ── */
    .jira-actions { display: flex; gap: 8px; padding-top: 2px; }
    .jira-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; border-radius: 8px;
      font-size: 0.83rem; font-weight: 600; cursor: pointer;
      transition: opacity 0.15s;
    }
    .jira-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .jira-btn--test {
      background: var(--bg-surface, rgba(255,255,255,0.06));
      border: 1px solid var(--border-light, rgba(255,255,255,0.12));
      color: var(--text-secondary, #8090A8);
    }
    .jira-btn--test:hover:not(:disabled) { background: var(--bg-card, rgba(255,255,255,0.1)); color: var(--text-primary, #E0E4F0); }
    .jira-btn--save {
      background: #2684ff; color: #fff; border: none;
    }
    .jira-btn--save:hover:not(:disabled) { opacity: 0.88; }

    /* ── Spinner ── */
    .jira-spinner {
      width: 13px; height: 13px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block; flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── How-to card ── */
    .jira-howto {
      padding: 14px 16px;
      border-radius: 10px;
      border: 1px solid var(--border-light, rgba(255,255,255,0.07));
      background: var(--bg-card, rgba(255,255,255,0.03));
    }
    .jira-howto-title {
      font-size: 0.78rem; font-weight: 700;
      color: var(--text-muted, #6A7290);
      text-transform: uppercase; letter-spacing: 0.06em;
      margin-bottom: 10px;
    }
    .jira-howto-steps {
      margin: 0; padding-left: 18px;
      display: flex; flex-direction: column; gap: 6px;
    }
    .jira-howto-steps li { font-size: 0.82rem; color: var(--text-secondary, #8090A8); line-height: 1.5; }
    .jira-howto-steps strong { color: var(--text-primary, #E0E4F0); }

    @media (max-width: 480px) {
      .jira-page { padding: 14px 12px 40px; }
      .jira-actions { flex-direction: column; }
      .jira-btn { justify-content: center; }
    }
  `]
})
export class JiraConfigComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  loading     = true;
  saving      = false;
  testing     = false;
  isConnected = false;
  connectedAs = '';
  showToken   = false;

  draft: { baseUrl: string; email: string; apiToken: string } = {
    baseUrl: '', email: '', apiToken: ''
  };

  errorMsg   = '';
  successMsg = '';

  get canSave(): boolean {
    const { baseUrl, email, apiToken } = this.draft;
    if (this.isConnected) {
      // update: at minimum baseUrl + email must be filled; token optional (keep existing if blank)
      return !!(baseUrl.trim() && email.trim());
    }
    return !!(baseUrl.trim() && email.trim() && apiToken.trim());
  }

  constructor(
    private jiraService: JiraService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.jiraService.getConfig().pipe(takeUntil(this.destroy$)).subscribe({
      next: config => {
        this.loading = false;
        if (config) {
          this.isConnected   = true;
          this.draft.baseUrl = config.baseUrl;
          this.draft.email   = config.email;
          this.draft.apiToken = '';
          // fetch display name silently
          this.jiraService.testConnection().pipe(takeUntil(this.destroy$)).subscribe({
            next: res => { this.connectedAs = res.displayName; this.cdr.markForCheck(); },
            error: ()  => { this.connectedAs = config.email; this.cdr.markForCheck(); }
          });
        }
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  saveConfig(): void {
    if (!this.canSave || this.saving) return;
    this.clearFeedback();
    this.saving = true;

    const payload = { ...this.draft };
    // if updating and token left blank, don't send it — but API requires it, so guard:
    // user must provide token on first save; on update blank means "keep existing"
    // We handle this by not sending apiToken when blank on update
    if (this.isConnected && !payload.apiToken.trim()) {
      // send a sentinel the backend can recognise — here we just omit it by re-using the masked placeholder
      payload.apiToken = '••••••••';
    }

    this.jiraService.saveConfig(payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.saving      = false;
        this.isConnected = true;
        this.successMsg  = 'JIRA credentials saved.';
        this.draft.apiToken = '';
        // re-test to get display name
        this.jiraService.testConnection().pipe(takeUntil(this.destroy$)).subscribe({
          next: res => { this.connectedAs = res.displayName; this.cdr.markForCheck(); },
          error: ()  => { this.connectedAs = this.draft.email; this.cdr.markForCheck(); }
        });
        this.cdr.markForCheck();
        setTimeout(() => { this.successMsg = ''; this.cdr.markForCheck(); }, 3000);
      },
      error: (err) => {
        this.saving    = false;
        this.errorMsg  = err?.error?.error ?? 'Failed to save. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  testConnection(): void {
    if (this.testing) return;
    this.clearFeedback();
    this.testing = true;
    this.jiraService.testConnection().pipe(takeUntil(this.destroy$)).subscribe({
      next: res => {
        this.testing     = false;
        this.connectedAs = res.displayName;
        this.successMsg  = `Connected as ${res.displayName}`;
        this.cdr.markForCheck();
        setTimeout(() => { this.successMsg = ''; this.cdr.markForCheck(); }, 3000);
      },
      error: (err) => {
        this.testing  = false;
        this.errorMsg = err?.error?.error ?? 'Connection test failed. Check your credentials.';
        this.cdr.markForCheck();
      }
    });
  }

  removeConfig(): void {
    this.clearFeedback();
    this.saving = true;
    this.jiraService.deleteConfig().pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.saving      = false;
        this.isConnected = false;
        this.connectedAs = '';
        this.draft       = { baseUrl: '', email: '', apiToken: '' };
        this.successMsg  = 'JIRA disconnected.';
        this.cdr.markForCheck();
        setTimeout(() => { this.successMsg = ''; this.cdr.markForCheck(); }, 3000);
      },
      error: (err) => {
        this.saving   = false;
        this.errorMsg = err?.error?.error ?? 'Failed to disconnect.';
        this.cdr.markForCheck();
      }
    });
  }

  private clearFeedback(): void {
    this.errorMsg  = '';
    this.successMsg = '';
  }
}
