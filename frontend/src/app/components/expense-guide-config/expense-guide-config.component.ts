import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ExpenseService, ExpenseGuideSettings } from '../../services/expense.service';
import { SmsListenerService } from '../../services/sms-listener.service';
import { NotificationListenerService } from '../../services/notification-listener.service';
import { Capacitor } from '@capacitor/core';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY'];
const CATEGORIES  = ['Uncategorized', 'Food & Dining', 'Transport', 'Shopping', 'Entertainment', 'Bills & Utilities', 'Health', 'Travel', 'Education', 'Other'];

@Component({
  selector: 'app-expense-guide-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="egc-page">
      <div class="egc-header">
        <h1 class="egc-title">ExpenseGuide Configuration</h1>
        <p class="egc-subtitle">Configure automatic expense tracking from your SMS messages.</p>
      </div>

      <div class="egc-card" *ngIf="loading">
        <div class="egc-spinner"></div>
        <span class="egc-loading-text">Loading settings…</span>
      </div>

      <ng-container *ngIf="!loading">

        <!-- SMS Listener Section -->
        <div class="egc-card">
          <div class="egc-card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span class="egc-card-title">SMS Transaction Listener</span>
            <div class="egc-badge" [class.egc-badge--on]="settings.smsListenerEnabled">
              {{ settings.smsListenerEnabled ? 'ON' : 'OFF' }}
            </div>
          </div>
          <p class="egc-card-desc">
            When enabled, Renmito reads incoming SMS messages in the background,
            extracts debit/credit transactions, and logs them automatically as expenses.
            No message content is sent to any server — all parsing happens on-device.
          </p>

          <div class="egc-row">
            <span class="egc-row-label">Enable SMS Listener</span>
            <button class="egc-toggle" [class.egc-toggle--on]="settings.smsListenerEnabled"
                    (click)="toggleSmsListener()" [disabled]="saving">
              <span class="egc-toggle-knob"></span>
            </button>
          </div>

          <div class="egc-android-note" *ngIf="!isAndroid">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            SMS listening is only available on the Android app.
          </div>

          <div class="egc-perm-status" *ngIf="isAndroid && settings.smsListenerEnabled">
            <div class="egc-perm-row" [class.egc-perm-row--ok]="permStatus === 'granted'">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline *ngIf="permStatus === 'granted'" points="20 6 9 17 4 12"/>
                <circle *ngIf="permStatus !== 'granted'" cx="12" cy="12" r="10"/>
                <line *ngIf="permStatus !== 'granted'" x1="12" y1="8" x2="12" y2="12"/>
                <line *ngIf="permStatus !== 'granted'" x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              SMS permission: {{ permStatus === 'granted' ? 'Granted' : 'Not granted' }}
            </div>
            <button class="egc-btn egc-btn--sm" *ngIf="permStatus !== 'granted'"
                    (click)="requestPermissions()">Grant permissions</button>
          </div>
        </div>

        <!-- Notification Listener Section -->
        <div class="egc-card">
          <div class="egc-card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
            <span class="egc-card-title">Notification Listener</span>
            <div class="egc-badge" [class.egc-badge--on]="settings.notificationListenerEnabled">
              {{ settings.notificationListenerEnabled ? 'ON' : 'OFF' }}
            </div>
          </div>
          <p class="egc-card-desc">
            When enabled, Renmito reads incoming notifications from all apps (banking, payment,
            UPI apps) and auto-detects transaction amounts. Works alongside the SMS listener
            — useful when banks send push notifications instead of SMS.
            All parsing happens on-device; no notification content leaves your phone.
          </p>

          <div class="egc-row">
            <span class="egc-row-label">Enable notification listener</span>
            <button class="egc-toggle" [class.egc-toggle--on]="settings.notificationListenerEnabled"
                    (click)="toggleNotificationListener()" [disabled]="saving">
              <span class="egc-toggle-knob"></span>
            </button>
          </div>

          <div class="egc-android-note" *ngIf="!isAndroid">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Notification listening is only available on the Android app.
          </div>

          <div class="egc-perm-status" *ngIf="isAndroid && settings.notificationListenerEnabled">
            <div class="egc-perm-row" [class.egc-perm-row--ok]="notifPermStatus === 'granted'">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline *ngIf="notifPermStatus === 'granted'" points="20 6 9 17 4 12"/>
                <circle *ngIf="notifPermStatus !== 'granted'" cx="12" cy="12" r="10"/>
                <line *ngIf="notifPermStatus !== 'granted'" x1="12" y1="8" x2="12" y2="12"/>
                <line *ngIf="notifPermStatus !== 'granted'" x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Notification access: {{ notifPermStatus === 'granted' ? 'Granted' : 'Not granted' }}
            </div>
            <button class="egc-btn egc-btn--sm" *ngIf="notifPermStatus !== 'granted'"
                    (click)="openNotificationSettings()">
              Grant access in settings
            </button>
            <span class="egc-card-desc" *ngIf="notifPermStatus !== 'granted'" style="margin:0;font-size:11px">
              Tap the button above, find Renmito, and toggle on "Allow notification access".
            </span>
          </div>
        </div>

        <!-- Sticky Notification Section -->
        <div class="egc-card">
          <div class="egc-card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span class="egc-card-title">Sticky Background Notification</span>
          </div>
          <p class="egc-card-desc">
            A persistent notification keeps Renmito alive in the background so that
            incoming SMS messages are captured even when the app is not in the foreground.
            Required for automatic expense detection.
          </p>
          <div class="egc-row">
            <span class="egc-row-label">Show sticky notification</span>
            <button class="egc-toggle" [class.egc-toggle--on]="settings.notificationEnabled"
                    (click)="toggleNotification()" [disabled]="saving">
              <span class="egc-toggle-knob"></span>
            </button>
          </div>
        </div>

        <!-- Test Notification Listener Section -->
        <div class="egc-card">
          <div class="egc-card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <span class="egc-card-title">Test Notification Listener</span>
            <div class="egc-badge" [class.egc-badge--test]="settings.testListenerEnabled">
              {{ settings.testListenerEnabled ? 'ON' : 'OFF' }}
            </div>
          </div>
          <p class="egc-card-desc">
            When enabled, every SMS transaction event received by the listener is also
            saved as a <strong>Test Log</strong> entry — visible in the Expenses screen under the
            "Test" tab. Use this to verify the listener is picking up messages without
            creating real expense records. The raw SMS body is shown alongside parsed data.
          </p>
          <div class="egc-row">
            <span class="egc-row-label">Enable test logging</span>
            <button class="egc-toggle" [class.egc-toggle--on]="settings.testListenerEnabled"
                    (click)="toggleTestListener()" [disabled]="saving">
              <span class="egc-toggle-knob"></span>
            </button>
          </div>
          <div class="egc-android-note" *ngIf="!isAndroid">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            SMS test logging is only meaningful on the Android app.
          </div>
        </div>

        <!-- Currency & Category -->
        <div class="egc-card">
          <div class="egc-card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            <span class="egc-card-title">Defaults</span>
          </div>

          <div class="egc-field">
            <label class="egc-field-label">Default currency</label>
            <select class="egc-select" [(ngModel)]="settings.currency" (change)="save()">
              <option *ngFor="let c of currencies" [value]="c">{{ c }}</option>
            </select>
          </div>

          <div class="egc-field">
            <label class="egc-field-label">Default category for auto-detected expenses</label>
            <select class="egc-select" [(ngModel)]="settings.defaultCategory" (change)="save()">
              <option *ngFor="let cat of categories" [value]="cat">{{ cat }}</option>
            </select>
          </div>
        </div>

        <!-- How it works -->
        <div class="egc-card egc-card--info">
          <div class="egc-card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span class="egc-card-title">How it works</span>
          </div>
          <ol class="egc-how-list">
            <li>Enable the SMS Listener and grant READ_SMS / RECEIVE_SMS permissions.</li>
            <li>A sticky notification appears in your notification drawer — this keeps the service alive.</li>
            <li>Every incoming SMS is scanned on-device for bank/UPI transaction patterns.</li>
            <li>Matched messages are automatically parsed: amount, merchant, and reference ID are extracted.</li>
            <li>A new expense entry is created and visible in the <strong>Expenses</strong> section immediately.</li>
            <li>You can review, edit category/merchant, or delete any auto-created expense.</li>
          </ol>
        </div>

        <div class="egc-save-row" *ngIf="saveStatus">
          <span class="egc-save-msg" [class.egc-save-msg--err]="saveStatus === 'error'">
            {{ saveStatus === 'saved' ? 'Settings saved.' : 'Failed to save. Try again.' }}
          </span>
        </div>

      </ng-container>
    </div>
  `,
  styles: [`
    .egc-page {
      max-width: 600px;
      padding: 20px 0 40px;
      display: flex; flex-direction: column; gap: 16px;
    }
    .egc-header { margin-bottom: 4px; }
    .egc-title {
      font-size: 22px; font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 4px;
    }
    .egc-subtitle {
      font-size: 13px; color: var(--text-secondary); margin: 0;
    }

    .egc-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      display: flex; flex-direction: column; gap: 12px;
    }
    .egc-card--info {
      border-color: var(--accent);
      background: color-mix(in srgb, var(--accent) 6%, var(--bg-surface));
    }
    .egc-card-header {
      display: flex; align-items: center; gap: 8px;
      color: var(--text-primary);
    }
    .egc-card-title {
      font-size: 14px; font-weight: 600; flex: 1;
    }
    .egc-card-desc {
      font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.5;
    }

    .egc-badge {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 10px; font-weight: 700;
      background: var(--border); color: var(--text-muted);
    }
    .egc-badge--on   { background: var(--accent); color: #fff; }
    .egc-badge--test { background: #f59e0b; color: #fff; }

    .egc-row {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px;
    }
    .egc-row-label { font-size: 13px; color: var(--text-primary); }

    .egc-toggle {
      position: relative;
      width: 44px; height: 24px;
      background: var(--border);
      border-radius: 12px;
      border: none; cursor: pointer;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    .egc-toggle--on { background: var(--accent); }
    .egc-toggle:disabled { opacity: 0.5; cursor: not-allowed; }
    .egc-toggle-knob {
      position: absolute;
      top: 3px; left: 3px;
      width: 18px; height: 18px;
      border-radius: 50%;
      background: #fff;
      transition: transform 0.2s;
    }
    .egc-toggle--on .egc-toggle-knob { transform: translateX(20px); }

    .egc-android-note {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: var(--text-muted);
      padding: 8px 10px;
      background: var(--bg-primary);
      border-radius: var(--radius-sm);
    }

    .egc-perm-status { display: flex; flex-direction: column; gap: 8px; }
    .egc-perm-row {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: var(--text-muted);
    }
    .egc-perm-row--ok { color: #4ade80; }

    .egc-field { display: flex; flex-direction: column; gap: 4px; }
    .egc-field-label { font-size: 12px; color: var(--text-secondary); }
    .egc-select {
      background: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 13px;
      padding: 8px 10px;
      width: 100%;
    }

    .egc-btn {
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: var(--radius-sm);
      padding: 6px 14px;
      font-size: 12px; font-weight: 600;
      cursor: pointer;
      align-self: flex-start;
    }
    .egc-btn--sm { font-size: 11px; padding: 5px 10px; }

    .egc-how-list {
      margin: 0; padding: 0 0 0 18px;
      font-size: 12px; color: var(--text-secondary);
      line-height: 1.8;
    }
    .egc-how-list li strong { color: var(--text-primary); }

    .egc-spinner {
      width: 24px; height: 24px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: egcSpin 0.6s linear infinite;
      align-self: center;
    }
    @keyframes egcSpin { to { transform: rotate(360deg); } }
    .egc-loading-text { font-size: 13px; color: var(--text-secondary); text-align: center; }

    .egc-save-row { display: flex; justify-content: flex-end; }
    .egc-save-msg { font-size: 12px; color: #4ade80; }
    .egc-save-msg--err { color: #f87171; }
  `]
})
export class ExpenseGuideConfigComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading  = true;
  saving   = false;
  saveStatus: 'saved' | 'error' | null = null;

  isAndroid  = Capacitor.getPlatform() === 'android';
  permStatus: 'granted' | 'denied' | 'unknown' = 'unknown';
  notifPermStatus: 'granted' | 'denied' | 'unknown' = 'unknown';

  currencies = CURRENCIES;
  categories = CATEGORIES;

  settings: ExpenseGuideSettings = {
    smsListenerEnabled:          false,
    notificationEnabled:         true,
    testListenerEnabled:         false,
    notificationListenerEnabled: false,
    currency:                    'INR',
    defaultCategory:             'Uncategorized',
  };

  constructor(
    private expenseService: ExpenseService,
    private smsListener: SmsListenerService,
    private notifListener: NotificationListenerService,
  ) {}

  ngOnInit(): void {
    this.expenseService.getSettings().pipe(takeUntil(this.destroy$)).subscribe(s => {
      this.settings = { ...this.settings, ...s };
      this.loading  = false;
      if (this.isAndroid && this.settings.smsListenerEnabled) this.checkPermissions();
      this.smsListener.setTestMode(this.settings.testListenerEnabled);
      this.notifListener.setTestMode(this.settings.testListenerEnabled);
      if (this.isAndroid && this.settings.notificationListenerEnabled) {
        this.applyNativeNotificationListenerState();
        this.checkNotifPermission();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleSmsListener(): void {
    this.settings.smsListenerEnabled = !this.settings.smsListenerEnabled;
    if (this.isAndroid && this.settings.smsListenerEnabled) {
      this.requestPermissions();
    }
    if (this.isAndroid) {
      this.applyNativeListenerState();
    }
    this.save();
  }

  toggleTestListener(): void {
    this.settings.testListenerEnabled = !this.settings.testListenerEnabled;
    this.smsListener.setTestMode(this.settings.testListenerEnabled);
    this.notifListener.setTestMode(this.settings.testListenerEnabled);
    this.save();
  }

  toggleNotificationListener(): void {
    this.settings.notificationListenerEnabled = !this.settings.notificationListenerEnabled;
    if (this.isAndroid) this.applyNativeNotificationListenerState();
    if (this.isAndroid && this.settings.notificationListenerEnabled) this.checkNotifPermission();
    this.save();
  }

  openNotificationSettings(): void {
    this.notifListener.openNotificationSettings();
  }

  private checkNotifPermission(): void {
    this.notifListener.checkPermission().then(status => {
      this.notifPermStatus = status;
    });
  }

  private applyNativeNotificationListenerState(): void {
    if (!this.isAndroid) return;
    if (this.settings.notificationListenerEnabled) {
      this.notifListener.startListening();
    } else {
      this.notifListener.stopListening();
    }
  }

  toggleNotification(): void {
    this.settings.notificationEnabled = !this.settings.notificationEnabled;
    if (this.isAndroid) this.applyNativeListenerState();
    this.save();
  }

  save(): void {
    this.saving = true;
    this.saveStatus = null;
    this.expenseService.saveSettings(this.settings).pipe(takeUntil(this.destroy$)).subscribe(result => {
      this.saving = false;
      this.saveStatus = result ? 'saved' : 'error';
      setTimeout(() => this.saveStatus = null, 2500);
    });
  }

  requestPermissions(): void {
    if (!this.isAndroid) return;
    this.smsListener.requestPermissions().then(status => {
      this.permStatus = status;
    });
  }

  private checkPermissions(): void {
    this.smsListener.checkPermissions().then(status => {
      this.permStatus = status;
    });
  }

  private applyNativeListenerState(): void {
    if (!this.isAndroid) return;
    if (this.settings.smsListenerEnabled) {
      this.smsListener.startListening(this.settings.notificationEnabled);
    } else {
      this.smsListener.stopListening();
    }
  }
}

