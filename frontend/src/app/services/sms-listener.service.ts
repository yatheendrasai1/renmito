import { Injectable, OnDestroy } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { ExpenseService } from './expense.service';

type PermStatus = 'granted' | 'denied' | 'unknown';

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

  // ─── Internals ────────────────────────────────────────────────────────────

  private attachListener(): void {
    this.removeListener();
    const plugin = this.getPlugin();
    if (!plugin) return;

    // addListener returns a handle with a remove() method
    plugin.addListener('smsTransaction', (data: any) => {
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
