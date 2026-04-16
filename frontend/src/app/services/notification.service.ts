import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type NotificationPermission = 'default' | 'granted' | 'denied' | 'unsupported';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly apiBase = `${environment.apiBase}/notifications`;
  private swRegistration: ServiceWorkerRegistration | null = null;

  constructor(private http: HttpClient) {}

  get isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  get permissionState(): NotificationPermission {
    if (!this.isSupported) return 'unsupported';
    return Notification.permission as NotificationPermission;
  }

  /** Returns true if we have an active push subscription stored in the backend. */
  async isSubscribed(): Promise<boolean> {
    if (!this.isSupported) return false;
    try {
      const reg = await this.getRegistration();
      const sub = await reg.pushManager.getSubscription();
      return !!sub;
    } catch {
      return false;
    }
  }

  /**
   * Registers the service worker, requests permission, creates a push
   * subscription and sends it to the backend.
   * Returns the resulting permission state.
   */
  async subscribe(): Promise<NotificationPermission> {
    if (!this.isSupported) return 'unsupported';

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission as NotificationPermission;

    try {
      const reg        = await this.getRegistration();
      const publicKey  = await this.fetchVapidKey();
      if (!publicKey) return 'denied';

      // Remove any stale subscription first
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey)
      });

      await firstValueFrom(
        this.http.post(`${this.apiBase}/subscribe`, { subscription: sub.toJSON() })
      );

      return 'granted';
    } catch (err) {
      console.error('[NotificationService] subscribe error:', err);
      return 'denied';
    }
  }

  /** Fires an immediate test notification through the server. */
  async sendTest(): Promise<'ok' | 'error'> {
    try {
      await firstValueFrom(this.http.post(`${this.apiBase}/test`, {}));
      return 'ok';
    } catch (err) {
      console.error('[NotificationService] test error:', err);
      return 'error';
    }
  }

  /** Unsubscribes from push and removes from the backend. */
  async unsubscribe(): Promise<void> {
    if (!this.isSupported) return;
    try {
      const reg = await this.getRegistration();
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;

      await firstValueFrom(
        this.http.delete(`${this.apiBase}/subscribe`, {
          body: { endpoint: sub.endpoint }
        })
      );

      await sub.unsubscribe();
    } catch (err) {
      console.error('[NotificationService] unsubscribe error:', err);
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async getRegistration(): Promise<ServiceWorkerRegistration> {
    if (this.swRegistration) return this.swRegistration;
    this.swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return this.swRegistration;
  }

  private async fetchVapidKey(): Promise<string | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ publicKey: string }>(`${this.apiBase}/vapid-public-key`)
      );
      return res?.publicKey ?? null;
    } catch {
      return null;
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw     = atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }
}
