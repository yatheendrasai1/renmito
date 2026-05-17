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
 * matches a transactional pattern.  This service subscribes to that event,
 * batches the parsed entries, and POSTs them to the backend via ExpenseService.
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
    this.appendTestLog(data);
  }

  private appendTestLog(data: any): void {
    const logs = this.getTestLogs();
    const entry: SmsTestLog = {
      id:          Math.random().toString(36).slice(2),
      timestamp:   new Date().toISOString(),
      smsRaw:      data.smsRaw   ?? data.body ?? '',
      smsSender:   data.smsSender ?? data.sender ?? '',
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

  private rawListenerHandle: any = null;

  private attachListener(): void {
    this.removeListener();
    const plugin = this.getPlugin();
    if (!plugin) return;

    plugin.addListener('smsTransaction', (data: any) => {
      this.onTransaction(data);
    }).then((handle: any) => {
      this.listenerHandle = handle;
    }).catch(() => {});

    // Raw listener: every SMS regardless of transaction pattern
    plugin.addListener('smsRaw', (data: any) => {
      this.onRawSms(data);
    }).then((handle: any) => {
      this.rawListenerHandle = handle;
    }).catch(() => {});
  }

  private removeListener(): void {
    if (this.listenerHandle) {
      try { this.listenerHandle.remove(); } catch {}
      this.listenerHandle = null;
    }
    if (this.rawListenerHandle) {
      try { this.rawListenerHandle.remove(); } catch {}
      this.rawListenerHandle = null;
    }
  }

  private onRawSms(data: any): void {
    if (!this.testMode) return;
    this.appendTestLog({
      smsRaw:    data.body    ?? '',
      smsSender: data.sender  ?? '',
      amount:    undefined,
      merchant:  undefined,
    });
  }

  private onTransaction(data: any): void {
    if (this.testMode) {
      this.appendTestLog(data);
    }

    // "zero eg" test phrase: save as real expense tagged isTestExpense, skip normal batch
    if (this.testMode && (data.smsRaw ?? data.body ?? '').toLowerCase().includes('zero eg')) {
      this.expenseService.create({
        amount:        data.amount ?? 0,
        currency:      data.currency ?? 'INR',
        merchant:      data.merchant || 'Test',
        category:      'Uncategorized',
        date:          data.date ?? new Date().toISOString().substring(0, 10),
        entryType:     'automatic',
        smsRaw:        data.smsRaw ?? '',
        smsSender:     data.smsSender ?? '',
        referenceId:   data.referenceId ?? '',
        paymentMethod: data.paymentMethod ?? '',
        isTestExpense: true,
      } as any).subscribe();
      return;
    }

    if (!data?.amount) return;
    this.pendingBatch.push(data);

    // Debounce: flush the batch 2 seconds after the last incoming SMS
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
      // Capacitor 8: registered plugins are available on the Capacitor global
      return (window as any)?.Capacitor?.Plugins?.SmsPlugin ?? null;
    } catch {
      return null;
    }
  }
}
