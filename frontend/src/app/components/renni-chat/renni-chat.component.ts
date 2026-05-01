import {
  Component, Input, Output, EventEmitter, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AiService, AiError, RenniMessage, ChatResponse } from '../../services/ai.service';
import { LogService } from '../../services/log.service';
import { LogEntry, CreateLogEntry } from '../../models/log.model';

@Component({
  selector: 'app-renni-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="renni-backdrop" (click)="close()"></div>

    <div class="renni-popup">
      <div class="renni-header">
        <div class="renni-header-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="renni-header-star">
            <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z"/>
            <path d="M5 3L5.75 5.25L8 6L5.75 6.75L5 9L4.25 6.75L2 6L4.25 5.25L5 3Z"/>
            <path d="M19 14L19.75 16.25L22 17L19.75 17.75L19 20L18.25 17.75L16 17L18.25 16.25L19 14Z"/>
          </svg>
          Renni
        </div>
        <button class="renni-close-btn" (click)="close()" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="renni-messages" #renniScroll>
        <div class="renni-empty" *ngIf="renniMsgs.length === 0">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" class="renni-empty-icon">
            <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z"/>
            <path d="M5 3L5.75 5.25L8 6L5.75 6.75L5 9L4.25 6.75L2 6L4.25 5.25L5 3Z"/>
            <path d="M19 14L19.75 16.25L22 17L19.75 17.75L19 20L18.25 17.75L16 17L18.25 16.25L19 14Z"/>
          </svg>
          <p>Hi! I'm Renni. Describe what you did and I'll log it, or ask anything about your day.</p>
        </div>
        <ng-container *ngFor="let msg of renniMsgs; let i = index; trackBy: trackByIndex">
          <div *ngIf="msg.from === 'user'" class="renni-msg renni-msg--user">
            <div class="renni-bubble renni-bubble--user">{{ msg.text }}</div>
          </div>
          <div *ngIf="msg.from === 'renni'" class="renni-msg renni-msg--renni">
            <div *ngIf="msg.thinking" class="renni-bubble renni-bubble--renni renni-thinking">
              <span class="renni-dot"></span><span class="renni-dot"></span><span class="renni-dot"></span>
            </div>
            <div *ngIf="!msg.thinking && msg.text && !msg.logs && !msg.isError" class="renni-bubble renni-bubble--renni">
              {{ msg.text }}
            </div>
            <div *ngIf="!msg.thinking && msg.text && msg.isError" class="renni-bubble renni-bubble--error">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{{ msg.text }}</span>
            </div>
            <div *ngIf="msg.confirmed" class="renni-bubble renni-bubble--renni renni-confirmed">
              ✓ Logged {{ msg.logs?.length }} {{ msg.logs?.length === 1 ? 'entry' : 'entries' }}
            </div>
            <div *ngIf="!msg.thinking && msg.logs && !msg.confirmed" class="renni-log-card">
              <div class="renni-log-card-intro">
                Found {{ msg.logs.length }} log{{ msg.logs.length > 1 ? 's' : '' }}. Review &amp; confirm:
              </div>
              <div class="renni-preview" *ngFor="let log of msg.logs; let j = index; trackBy: trackByIndex">
                <div class="renni-card-top">
                  <span class="renni-card-badge">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    {{ log.logTypeName }}
                    <span class="renni-domain-dot" style="text-transform:capitalize">· {{ log.domain }}</span>
                  </span>
                  <button class="renni-remove-btn" (click)="removeRenniLog(i, j)" title="Remove">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                <div class="renni-edit-row">
                  <span class="renni-preview-label">Title</span>
                  <input class="renni-edit-input" [(ngModel)]="log.title" placeholder="Title" />
                </div>
                <div class="renni-edit-row" *ngIf="log.entryType === 'point'">
                  <span class="renni-preview-label">Time</span>
                  <input class="renni-edit-input renni-time-input" [(ngModel)]="log.pointTime" placeholder="HH:MM" />
                </div>
                <div class="renni-edit-row" *ngIf="log.entryType === 'range'">
                  <span class="renni-preview-label">Time</span>
                  <input class="renni-edit-input renni-time-input" [(ngModel)]="log.startTime" placeholder="HH:MM" />
                  <span class="renni-time-sep">–</span>
                  <input class="renni-edit-input renni-time-input" [(ngModel)]="log.endTime" placeholder="HH:MM" />
                </div>
              </div>
              <div class="renni-log-actions">
                <button class="renni-discard-btn" (click)="discardRenniLogs(i)">Discard</button>
                <button class="renni-confirm-btn" (click)="confirmRenniLogs(i)" [disabled]="msg.saving">
                  {{ msg.saving ? 'Saving…' : (msg.logs.length > 1 ? 'Log all (' + msg.logs.length + ')' : 'Log it') }}
                </button>
              </div>
              <div class="renni-error" *ngIf="msg.error">{{ msg.error }}</div>
            </div>
          </div>
        </ng-container>
      </div>

      <div class="renni-input-row">
        <textarea class="renni-input-field"
                  [(ngModel)]="renniInput"
                  placeholder="Describe logs or ask anything…"
                  rows="4"
                  (keydown)="onRenniKeydown($event)"></textarea>
        <button class="renni-send-btn"
                (click)="sendRenniMessage()"
                [disabled]="renniThinking || !renniInput.trim()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .renni-backdrop {
      position: fixed; inset: 0; z-index: 310;
      background: rgba(0,0,0,0.5);
    }
    .renni-popup {
      position: fixed;
      bottom: calc(58px + env(safe-area-inset-bottom, 0px));
      left: 0; right: 0;
      height: 75dvh;
      z-index: 311;
      max-width: 560px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-bottom: none;
      border-radius: 20px 20px 0 0;
      overflow: hidden;
      animation: renniSlideUp 0.25s ease;
    }
    @keyframes renniSlideUp {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }
    .renni-header {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .renni-header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.95rem;
      font-weight: 700;
      background: linear-gradient(135deg, #a78bfa, #7c3aed);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .renni-header-star { color: #a78bfa; flex-shrink: 0; }
    .renni-close-btn {
      background: none; border: none; cursor: pointer;
      color: var(--text-secondary); padding: 4px;
      display: flex; align-items: center; border-radius: 6px;
      opacity: 0.7;
    }
    .renni-close-btn:hover { opacity: 1; background: rgba(255,255,255,0.07); }

    .renni-messages {
      flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;
      padding: 12px 16px 4px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .renni-empty {
      display: flex; flex-direction: column; align-items: center;
      gap: 12px; padding: 32px 20px; text-align: center; opacity: 0.6;
      margin: auto 0;
    }
    .renni-empty p { font-size: 0.88rem; line-height: 1.6; margin: 0; }
    .renni-empty-icon { color: #a78bfa; }
    .renni-msg { display: flex; flex-direction: column; max-width: 88%; }
    .renni-msg--user { align-self: flex-end; align-items: flex-end; }
    .renni-msg--renni { align-self: flex-start; align-items: flex-start; }
    .renni-bubble {
      padding: 9px 13px; border-radius: 16px;
      font-size: 0.86rem; line-height: 1.45; word-break: break-word;
    }
    .renni-bubble--user {
      background: var(--accent, #6366f1); color: #fff;
      border-radius: 16px 16px 4px 16px;
    }
    .renni-bubble--renni {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px 16px 16px 4px;
    }
    .renni-bubble--error {
      display: flex; align-items: flex-start; gap: 7px;
      padding: 9px 13px; border-radius: 16px 16px 16px 4px;
      background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3);
      color: #fca5a5; font-size: 0.86rem; line-height: 1.45; word-break: break-word;
    }
    .renni-confirmed {
      background: rgba(167,139,250,0.15); border-color: rgba(167,139,250,0.3);
      color: #a78bfa; font-weight: 500;
    }
    .renni-thinking { display: flex; gap: 5px; padding: 12px 16px; align-items: center; }
    .renni-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: currentColor; opacity: 0.5;
      animation: renniPulse 1.2s ease-in-out infinite;
    }
    .renni-dot:nth-child(2) { animation-delay: 0.2s; }
    .renni-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes renniPulse {
      0%, 80%, 100% { opacity: 0.2; transform: scale(0.85); }
      40% { opacity: 0.9; transform: scale(1); }
    }
    .renni-log-card {
      background: rgba(167,139,250,0.07); border: 1px solid rgba(167,139,250,0.2);
      border-radius: 12px; padding: 10px 12px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .renni-log-card-intro { font-size: 0.78rem; opacity: 0.7; padding-bottom: 2px; }
    .renni-preview {
      background: rgba(167,139,250,0.08); border: 1px solid rgba(167,139,250,0.2);
      border-radius: 8px; padding: 8px 10px;
      display: flex; flex-direction: column; gap: 7px;
    }
    .renni-card-top { display: flex; align-items: center; justify-content: space-between; }
    .renni-card-badge {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 0.76rem; font-weight: 600; color: #a78bfa;
    }
    .renni-domain-dot { opacity: 0.65; font-weight: 400; }
    .renni-remove-btn {
      background: none; border: none; cursor: pointer;
      color: inherit; opacity: 0.4; padding: 2px; display: flex; align-items: center;
    }
    .renni-remove-btn:hover { opacity: 0.8; }
    .renni-edit-row { display: flex; align-items: center; gap: 8px; }
    .renni-preview-label { font-size: 0.72rem; opacity: 0.55; width: 38px; flex-shrink: 0; }
    .renni-edit-input {
      flex: 1; padding: 5px 8px;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 6px; color: inherit; font-size: 0.83rem;
    }
    .renni-edit-input:focus { outline: none; border-color: rgba(167,139,250,0.5); }
    .renni-time-input { flex: 0 0 72px; font-family: monospace; }
    .renni-time-sep { opacity: 0.5; font-size: 0.8rem; }
    .renni-log-actions { display: flex; gap: 8px; padding-top: 2px; }
    .renni-discard-btn {
      flex: 1; padding: 7px 10px; border-radius: 8px; font-size: 0.82rem;
      background: transparent; border: 1px solid rgba(255,255,255,0.15);
      color: var(--text-secondary); cursor: pointer;
    }
    .renni-confirm-btn {
      flex: 2; padding: 7px 10px; border-radius: 8px; font-size: 0.82rem;
      font-weight: 600; background: linear-gradient(135deg, #7c3aed, #a78bfa);
      border: none; color: #fff; cursor: pointer;
    }
    .renni-confirm-btn:disabled { opacity: 0.6; cursor: default; }
    .renni-error {
      font-size: 0.78rem; color: #f87171;
      background: rgba(248,113,113,0.1); border-radius: 6px; padding: 6px 9px;
    }
    .renni-input-row {
      flex-shrink: 0;
      display: flex; gap: 8px; align-items: flex-end;
      padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px));
      border-top: 1px solid rgba(255,255,255,0.07);
    }
    .renni-input-field {
      flex: 1; resize: none;
      padding: 10px 12px; border-radius: 12px;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
      color: inherit; font-size: 0.87rem; line-height: 1.5; font-family: inherit;
    }
    .renni-input-field:focus { outline: none; border-color: rgba(167,139,250,0.4); }
    .renni-send-btn {
      flex-shrink: 0; width: 40px; height: 40px; border-radius: 12px;
      background: linear-gradient(135deg, #7c3aed, #a78bfa);
      border: none; color: #fff; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      align-self: flex-end;
    }
    .renni-send-btn:disabled { opacity: 0.45; cursor: default; }
  `],
})
export class RenniChatComponent implements OnDestroy {
  @Input() selectedDate: Date = new Date();
  @Input() logs: LogEntry[] = [];

  @Output() closed     = new EventEmitter<void>();
  @Output() logCreated = new EventEmitter<void>();

  private readonly destroy$ = new Subject<void>();

  renniMsgs: RenniMessage[]  = [];
  renniInput    = '';
  renniThinking = false;

  constructor(
    private aiService:  AiService,
    private logService: LogService,
    private cd:         ChangeDetectorRef,
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private get selectedDateStr(): string {
    const d = this.selectedDate;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  close(): void {
    this.renniMsgs     = [];
    this.renniInput    = '';
    this.renniThinking = false;
    this.closed.emit();
  }

  onRenniKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendRenniMessage(); }
  }

  sendRenniMessage(): void {
    const text = this.renniInput.trim();
    if (!text || this.renniThinking) return;
    this.renniInput    = '';
    this.renniThinking = true;
    this.renniMsgs.push({ from: 'user', text });
    const thinkingIdx = this.renniMsgs.length;
    this.renniMsgs.push({ from: 'renni', thinking: true });
    this._scrollToBottom();
    this.cd.markForCheck();

    this.aiService.chat(text, this.selectedDateStr).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: ChatResponse) => {
        this.renniThinking = false;
        if (res.type === 'logs' && res.logs?.length) {
          this.renniMsgs[thinkingIdx] = { from: 'renni', logs: res.logs };
        } else {
          this.renniMsgs[thinkingIdx] = { from: 'renni', text: res.text || 'Done!' };
        }
        this._scrollToBottom();
        this.cd.markForCheck();
      },
      error: (err: AiError) => {
        this.renniThinking = false;
        this.renniMsgs[thinkingIdx] = {
          from: 'renni',
          text: err.message || 'Something went wrong. Try again.',
          isError: true,
          errorCode: err.code,
        };
        this._scrollToBottom();
        this.cd.markForCheck();
      },
    });
  }

  removeRenniLog(msgIdx: number, logIdx: number): void {
    const msg = this.renniMsgs[msgIdx];
    if (!msg?.logs) return;
    msg.logs.splice(logIdx, 1);
    if (msg.logs.length === 0) this.renniMsgs.splice(msgIdx, 1);
    this.cd.markForCheck();
  }

  discardRenniLogs(msgIdx: number): void {
    this.renniMsgs.splice(msgIdx, 1);
    this.cd.markForCheck();
  }

  confirmRenniLogs(msgIdx: number): void {
    const msg = this.renniMsgs[msgIdx];
    if (!msg?.logs?.length || msg.saving) return;
    msg.saving = true;
    msg.error  = undefined;
    const logs    = [...msg.logs];
    const dateStr = this.selectedDateStr;
    const saveNext = (idx: number) => {
      if (idx >= logs.length) {
        msg.saving    = false;
        msg.confirmed = true;
        this.logCreated.emit();
        this._scrollToBottom();
        this.cd.markForCheck();
        return;
      }
      const p = logs[idx];
      const payload: CreateLogEntry & { pointAtISO?: string; startAtISO?: string; endAtISO?: string } = {
        title: p.title, logTypeId: p.logTypeId, entryType: p.entryType,
        source: 'ai', startTime: p.startTime ?? '', endTime: p.endTime ?? '',
      };
      if (p.entryType === 'point') {
        payload.pointAtISO = `${dateStr}T${p.pointTime}:00.000Z`;
        payload.pointTime  = p.pointTime ?? '';
      } else {
        payload.startAtISO = `${dateStr}T${p.startTime}:00.000Z`;
        payload.endAtISO   = `${dateStr}T${p.endTime}:00.000Z`;
      }
      this.logService.createLog(this.selectedDate, payload).pipe(takeUntil(this.destroy$)).subscribe({
        next:  () => saveNext(idx + 1),
        error: err => {
          msg.saving = false;
          msg.error  = `Failed on "${p.title}": ${err.error?.error || 'Save error'}`;
          this.cd.markForCheck();
        },
      });
    };
    saveNext(0);
  }

  trackByIndex(i: number): number { return i; }

  private _scrollToBottom(): void {
    setTimeout(() => {
      const el = document.querySelector('.renni-messages');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }
}
