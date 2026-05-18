import { Injectable, OnDestroy } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { ExpenseService } from './expense.service';

type PermStatus = 'granted' | 'denied' | 'unknown';

export interface SmsTestLog {
  id:        string;
  timestamp: string;
  smsRaw:    string;
  smsSender: string;
  amount?:   number;
  merchant?: string;
  referenceId?: string;
}

const TEST_LOGS_KEY = 'renmito-sms-test-logs';

/**
 * Bridges the native SmsPlugin (Android Capacitor plugin) to Angular.
 *
 * On Android the plugin emits a "smsTransaction" event for every SMS that
 * matches a transactional pattern or contains the "zero eg" test phrase.
 * This service subscribes to that event, batches parsed entries, and POSTs
 * them to the backend via ExpenseService.
 *
 * On non-Android platforms all methods are safe no-ops.
 */
@Injectable({ providedIn: 'root' })
export class SmsListenerService implements OnDestroy {

  private listenerHandle: any = null;
  private pendingBatch: any[] = [];
  private batchTimer: any = null;
  private testMode = false;

  constructor(private expenseService: ExpenseService) {}

  ngOnDestroy(): void {
    this.removeListener();
    if (this.batchTimer) clearTimeout(this.batchTimer);
  }

  get isAndroid(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  async startListening(showNotification = true): Promise<void> {
    if (!this.isAndroid) return;
    try {
      const plugin = this.getPlugin();
      if (!plugin) return;
      await plugin.startListening({ showNotification });
      this.attachListener();
    } catch (err) {
      console.warn('[SmsListener] startListening failed', err);
    }
  }

  async stopListening(): Promise<void> {
    if (!this.isAndroid) return;
    try {
      const plugin = this.getPlugin();
      if (plugin) await plugin.stopListening();
      this.removeListener();
    } catch (err) {
      console.warn('[SmsListener] stopListening failed', err);
    }
  }

  async checkPermissions(): Promise<PermStatus> {
    if (!this.isAndroid) return 'unknown';
    try {
      const plugin = this.getPlugin();
      if (!plugin) return 'unknown';
      const res = await plugin.checkPermissions();
      return res?.receive === 'granted' && res?.read === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'unknown';
    }
  }

  async requestPermissions(): Promise<PermStatus> {
    if (!this.isAndroid) return 'unknown';
    try {
      const plugin = this.getPlugin();
      if (!plugin) return 'unknown';
      const res = await plugin.requestPermissions();
      return res?.receive === 'granted' && res?.read === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }

  // ─── Test mode ────────────────────────────────────────────────────────────

  setTestMode(enabled: boolean): void {
    this.testMode = enabled;
  }

  getTestLogs(): SmsTestLog[] {
    try {
      const raw = localStorage.getItem(TEST_LOGS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  clearTestLogs(): void {
    localStorage.removeItem(TEST_LOGS_KEY);
  }

  appendTestLogEntry(data: { smsRaw: string; smsSender: string; amount?: number; merchant?: string; referenceId?: string }): void {
    const logs = this.getTestLogs();
    const entry: SmsTestLog = {
      id:          Math.random().toString(36).slice(2),
      timestamp:   new Date().toISOString(),
      smsRaw:      data.smsRaw,
      smsSender:   data.smsSender,
      amount:      data.amount,
      merchant:    data.merchant,
      referenceId: data.referenceId,
    };
    logs.unshift(entry);
    try {
      localStorage.setItem(TEST_LOGS_KEY, JSON.stringify(logs.slice(0, 200)));
    } catch {}
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private attachListener(): void {
    this.removeListener();
    const plugin = this.getPlugin();
    if (!plugin) return;

    const result = plugin.addListener('smsTransaction', (data: any) => {
      this.onTransaction(data);
    });
    if (result && typeof (result as any).then === 'function') {
      (result as any).then((h: any) => { this.listenerHandle = h; }).catch(() => {});
    } else {
      this.listenerHandle = result;
    }
  }

  private removeListener(): void {
    if (this.listenerHandle) {
      try { this.listenerHandle.remove(); } catch {}
      this.listenerHandle = null;
    }
  }

  private onTransaction(data: any): void {
    if (this.testMode) {
      this.appendTestLogEntry({
        smsRaw:      data.smsRaw ?? '',
        smsSender:   data.smsSender ?? '',
        amount:      data.amount,
        merchant:    data.merchant,
        referenceId: data.referenceId,
      });
    }

    // "zero eg" test phrase: save as real expense tagged isTestExpense, skip batch
    if (this.testMode && (data.smsRaw ?? '').toLowerCase().includes('zero eg')) {
      this.expenseService.create({
        amount:          data.amount ?? 0,
        currency:        data.currency ?? 'INR',
        merchant:        data.merchant || 'Test',
        category:        'Uncategorized',
        date:            data.date ?? new Date().toISOString().substring(0, 10),
        entryType:       'automatic',
        transactionType: data.transactionType ?? 'debit',
        smsRaw:          data.smsRaw ?? '',
        smsSender:       data.smsSender ?? '',
        referenceId:     data.referenceId ?? '',
        paymentMethod:   data.paymentMethod ?? '',
        isTestExpense:   true,
      } as any).subscribe();
      return;
    }

    if (!data?.amount) return;
    this.pendingBatch.push(data);

    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.batchTimer = setTimeout(() => this.flushBatch(), 2000);
  }

  private flushBatch(): void {
    if (this.pendingBatch.length === 0) return;
    const entries = [...this.pendingBatch];
    this.pendingBatch = [];
    this.expenseService.bulkCreate(entries).subscribe();
  }

  private getPlugin(): any {
    try {
      return (window as any)?.Capacitor?.Plugins?.SmsPlugin ?? null;
    } catch {
      return null;
    }
  }
}
