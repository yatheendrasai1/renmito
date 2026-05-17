import { Injectable, OnDestroy } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { ExpenseService } from './expense.service';
import { SmsListenerService } from './sms-listener.service';

type PermStatus = 'granted' | 'denied' | 'unknown';

/**
 * Bridges the native NotificationPlugin (Android Capacitor plugin) to Angular.
 *
 * On Android the plugin emits a "notificationTransaction" event for every
 * notification that matches a transactional pattern (or contains the "zero eg"
 * test phrase).  This service subscribes to that event, batches regular entries,
 * and POSTs them to the backend via ExpenseService.
 *
 * "zero eg" test events bypass the batch and are immediately saved as individual
 * expenses with isTestExpense: true (handled in onTransaction, same as SmsListenerService).
 *
 * On non-Android platforms all methods are safe no-ops.
 */
@Injectable({ providedIn: 'root' })
export class NotificationListenerService implements OnDestroy {

  private listenerHandle: any = null;
  private pendingBatch: any[] = [];
  private batchTimer: any = null;
  private testMode = false;

  constructor(
    private expenseService: ExpenseService,
    private smsListener: SmsListenerService,
  ) {}

  ngOnDestroy(): void {
    this.removeListener();
    if (this.batchTimer) clearTimeout(this.batchTimer);
  }

  get isAndroid(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  setTestMode(enabled: boolean): void {
    this.testMode = enabled;
  }

  async startListening(): Promise<void> {
    if (!this.isAndroid) return;
    try {
      const plugin = this.getPlugin();
      if (!plugin) return;
      await plugin.startListening();
      this.attachListener();
    } catch (err) {
      console.warn('[NotificationListener] startListening failed', err);
    }
  }

  async stopListening(): Promise<void> {
    if (!this.isAndroid) return;
    try {
      const plugin = this.getPlugin();
      if (plugin) await plugin.stopListening();
      this.removeListener();
    } catch (err) {
      console.warn('[NotificationListener] stopListening failed', err);
    }
  }

  async checkPermission(): Promise<PermStatus> {
    if (!this.isAndroid) return 'unknown';
    try {
      const plugin = this.getPlugin();
      if (!plugin) return 'unknown';
      const res = await plugin.checkPermission();
      return res?.status === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'unknown';
    }
  }

  async openNotificationSettings(): Promise<void> {
    if (!this.isAndroid) return;
    try {
      const plugin = this.getPlugin();
      if (plugin) await plugin.openNotificationSettings();
    } catch {}
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private attachListener(): void {
    this.removeListener();
    const plugin = this.getPlugin();
    if (!plugin) return;

    plugin.addListener('notificationTransaction', (data: any) => {
      this.onTransaction(data);
    }).then((handle: any) => {
      this.listenerHandle = handle;
    }).catch(() => {});
  }

  private removeListener(): void {
    if (this.listenerHandle) {
      try { this.listenerHandle.remove(); } catch {}
      this.listenerHandle = null;
    }
  }

  private onTransaction(data: any): void {
    // Test mode: save to test log store regardless
    if (this.testMode) {
      this.smsListener.appendTestLogEntry({
        smsRaw:      data.smsRaw   ?? data.body ?? '',
        smsSender:   data.smsSender ?? data.sender ?? '',
        amount:      data.amount,
        merchant:    data.merchant,
        referenceId: data.referenceId,
      });
    }

    // "zero eg" test phrase: save as a real expense tagged isTestExpense
    if (this.testMode && (data.smsRaw ?? '').toLowerCase().includes('zero eg')) {
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

    // Regular transaction: batch + bulk-save
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
      return (window as any)?.Capacitor?.Plugins?.NotificationPlugin ?? null;
    } catch {
      return null;
    }
  }
}
