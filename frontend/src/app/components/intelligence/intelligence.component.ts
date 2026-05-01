import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ConfigService } from '../../services/config.service';

type IntelTab  = 'models' | 'prompts' | 'features';
type IntelStep = 'list' | 'choose' | 'gemini-key';

const TABS: IntelTab[] = ['models', 'prompts', 'features'];

@Component({
  selector: 'app-intelligence',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="intel-page">

      <!-- ── Header ──────────────────────────────────────────── -->
      <div class="intel-header">
        <div class="intel-header-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
          </svg>
        </div>
        <div class="intel-header-text">
          <h2 class="intel-title">Intelligence</h2>
          <p class="intel-sub">AI models, prompts &amp; features</p>
        </div>
        <span class="intel-badge" *ngIf="geminiConfigured">Connected</span>
      </div>

      <!-- ── Tab bar ─────────────────────────────────────────── -->
      <div class="tab-bar">
        <button class="tab-btn" [class.tab-btn--active]="activeTab === 'models'"
                (click)="setTab('models')" type="button">Models</button>
        <button class="tab-btn" [class.tab-btn--active]="activeTab === 'prompts'"
                (click)="setTab('prompts')" type="button">Prompts</button>
        <button class="tab-btn" [class.tab-btn--active]="activeTab === 'features'"
                (click)="setTab('features')" type="button">Features</button>
        <div class="tab-indicator" [style.transform]="'translateX(' + (tabIndex * 100) + '%)'"></div>
      </div>

      <!-- ── Swipeable content ────────────────────────────────── -->
      <div class="tabs-viewport"
           (touchstart)="onTouchStart($event)"
           (touchend)="onTouchEnd($event)">
        <div class="tabs-track" [style.transform]="'translateX(' + (-tabIndex * 33.333) + '%)'">

          <!-- Models ─────────────────────────────────────────── -->
          <div class="tab-panel">

            <!-- No model configured -->
            <div class="model-empty" *ngIf="!geminiConfigured && intelStep === 'list'">
              <div class="model-empty-art">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.25">
                  <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
                  <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
                </svg>
              </div>
              <p class="model-empty-text">No AI model connected</p>
              <p class="model-empty-hint">Connect a model to unlock Renni and smart log parsing.</p>
              <button class="model-add-btn" (click)="intelStep = 'choose'" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Connect a model
              </button>
            </div>

            <!-- Model connected -->
            <div class="model-connected" *ngIf="geminiConfigured && intelStep === 'list'">
              <div class="section-label">Connected Model</div>
              <div class="model-card">
                <div class="model-card-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <div class="model-card-info">
                  <span class="model-card-name">Google Gemini</span>
                  <span class="model-card-model">gemini-2.5-flash-lite</span>
                  <span class="model-card-desc">Powers Renni chat &amp; smart log parsing</span>
                </div>
                <span class="status-badge status-badge--ok">Active</span>
              </div>
              <div class="model-actions">
                <button class="model-action-btn" (click)="intelStep = 'gemini-key'" type="button">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Update API key
                </button>
              </div>

              <div class="section-label" style="margin-top:24px">Used by</div>
              <div class="feature-chip-list">
                <div class="feature-chip">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Renni Chat
                </div>
                <div class="feature-chip">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                  Log Parsing
                </div>
              </div>
            </div>

            <!-- Choose provider -->
            <div class="choose-provider" *ngIf="intelStep === 'choose'">
              <div class="section-label">Choose a provider</div>
              <button class="provider-card" (click)="intelStep = 'gemini-key'" type="button">
                <div class="provider-card-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <div class="provider-card-info">
                  <span class="provider-card-name">Google Gemini</span>
                  <span class="provider-card-desc">Fast, multimodal AI — gemini-2.5-flash-lite</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" opacity="0.4">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
              <button class="back-btn" (click)="intelStep = 'list'" type="button">← Back</button>
            </div>

            <!-- Gemini key form -->
            <div class="key-form" *ngIf="intelStep === 'gemini-key'">
              <div class="key-form-header">
                <div class="provider-card-icon provider-card-icon--sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <span class="key-form-title">Gemini API Key</span>
              </div>

              <div class="key-row">
                <input class="key-input"
                       [type]="showKey ? 'text' : 'password'"
                       [(ngModel)]="apiKeyInput"
                       placeholder="AIza…"
                       autocomplete="off"
                       spellcheck="false"/>
                <button class="key-toggle" (click)="showKey = !showKey" type="button">
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

              <p class="key-hint">
                Get your key from
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" class="key-link">Google AI Studio</a>.
                The key is verified before saving.
              </p>

              <div class="feedback feedback--error" *ngIf="intelErrorMsg">{{ intelErrorMsg }}</div>
              <div class="feedback feedback--ok"    *ngIf="intelSuccessMsg">{{ intelSuccessMsg }}</div>

              <div class="key-form-footer">
                <button class="btn-cancel" (click)="cancelIntelKey()" type="button">Cancel</button>
                <button class="btn-save" (click)="saveKey()"
                        [disabled]="saving || !apiKeyInput.trim()" type="button">
                  {{ saving ? 'Verifying…' : 'Verify & Save' }}
                </button>
              </div>
            </div>

          </div><!-- /models panel -->

          <!-- Prompts ─────────────────────────────────────────── -->
          <div class="tab-panel tab-panel--soon">
            <div class="soon-container">
              <div class="soon-anim">
                <div class="pot-wrap">
                  <svg class="pot-svg" width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <!-- pot body -->
                    <rect x="12" y="30" width="40" height="26" rx="6" fill="rgba(167,139,250,0.15)" stroke="rgba(167,139,250,0.4)" stroke-width="1.5"/>
                    <!-- lid -->
                    <rect x="8" y="24" width="48" height="9" rx="4" fill="rgba(167,139,250,0.2)" stroke="rgba(167,139,250,0.5)" stroke-width="1.5"/>
                    <!-- handle top -->
                    <rect x="28" y="18" width="8" height="7" rx="3" fill="rgba(167,139,250,0.3)" stroke="rgba(167,139,250,0.5)" stroke-width="1.5"/>
                    <!-- handles side left -->
                    <rect x="4" y="30" width="9" height="6" rx="3" fill="rgba(167,139,250,0.2)" stroke="rgba(167,139,250,0.4)" stroke-width="1.5"/>
                    <!-- handles side right -->
                    <rect x="51" y="30" width="9" height="6" rx="3" fill="rgba(167,139,250,0.2)" stroke="rgba(167,139,250,0.4)" stroke-width="1.5"/>
                  </svg>
                  <!-- steam lines -->
                  <div class="steam steam-1"></div>
                  <div class="steam steam-2"></div>
                  <div class="steam steam-3"></div>
                </div>
              </div>
              <h3 class="soon-title">Something's brewing</h3>
              <p class="soon-text">Prompt library with editable templates<br>is on its way.</p>
              <div class="soon-dots">
                <span class="soon-dot soon-dot--1"></span>
                <span class="soon-dot soon-dot--2"></span>
                <span class="soon-dot soon-dot--3"></span>
              </div>
            </div>
          </div><!-- /prompts panel -->

          <!-- Features ────────────────────────────────────────── -->
          <div class="tab-panel tab-panel--soon">
            <div class="soon-container">
              <div class="soon-anim">
                <div class="pot-wrap">
                  <svg class="pot-svg" width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <rect x="12" y="30" width="40" height="26" rx="6" fill="rgba(99,179,237,0.12)" stroke="rgba(99,179,237,0.35)" stroke-width="1.5"/>
                    <rect x="8" y="24" width="48" height="9" rx="4" fill="rgba(99,179,237,0.18)" stroke="rgba(99,179,237,0.45)" stroke-width="1.5"/>
                    <rect x="28" y="18" width="8" height="7" rx="3" fill="rgba(99,179,237,0.25)" stroke="rgba(99,179,237,0.45)" stroke-width="1.5"/>
                    <rect x="4" y="30" width="9" height="6" rx="3" fill="rgba(99,179,237,0.18)" stroke="rgba(99,179,237,0.35)" stroke-width="1.5"/>
                    <rect x="51" y="30" width="9" height="6" rx="3" fill="rgba(99,179,237,0.18)" stroke="rgba(99,179,237,0.35)" stroke-width="1.5"/>
                  </svg>
                  <div class="steam steam-1 steam--blue"></div>
                  <div class="steam steam-2 steam--blue"></div>
                  <div class="steam steam-3 steam--blue"></div>
                </div>
              </div>
              <h3 class="soon-title">Cooking up features</h3>
              <p class="soon-text">AI-driven features like smart summaries<br>and activity insights are coming.</p>
              <div class="soon-dots">
                <span class="soon-dot soon-dot--1 soon-dot--blue"></span>
                <span class="soon-dot soon-dot--2 soon-dot--blue"></span>
                <span class="soon-dot soon-dot--3 soon-dot--blue"></span>
              </div>
            </div>
          </div><!-- /features panel -->

        </div><!-- /tabs-track -->
      </div><!-- /tabs-viewport -->

    </div><!-- /intel-page -->
  `,
  styles: [`
    /* ── Page shell ─────────────────────────────────────────── */
    .intel-page {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg-primary);
      overflow: hidden;
    }

    /* ── Header ──────────────────────────────────────────────── */
    .intel-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 18px 14px;
      flex-shrink: 0;
    }
    .intel-header-icon {
      width: 38px; height: 38px; border-radius: 10px;
      background: rgba(167,139,250,0.12);
      display: flex; align-items: center; justify-content: center;
      color: #a78bfa; flex-shrink: 0;
    }
    .intel-header-text { flex: 1; min-width: 0; }
    .intel-title {
      font-size: 1.05rem; font-weight: 700; margin: 0 0 2px;
      color: var(--text-primary, #E0E4F0);
    }
    .intel-sub {
      font-size: 0.76rem; margin: 0;
      color: var(--text-muted, #6A7290);
    }
    .intel-badge {
      font-size: 0.68rem; font-weight: 700; letter-spacing: 0.04em;
      padding: 3px 9px; border-radius: 10px; flex-shrink: 0;
      background: rgba(74,222,128,0.13); color: #4ade80;
    }

    /* ── Tab bar ─────────────────────────────────────────────── */
    .tab-bar {
      position: relative;
      display: flex;
      flex-shrink: 0;
      margin: 0 18px;
      border-radius: 10px;
      background: var(--bg-card, rgba(255,255,255,0.04));
      border: 1px solid var(--border-light, rgba(255,255,255,0.07));
      padding: 3px;
      gap: 0;
    }
    .tab-btn {
      flex: 1; padding: 8px 4px;
      background: none; border: none; cursor: pointer;
      font-size: 0.82rem; font-weight: 600;
      color: var(--text-muted, #6A7290);
      border-radius: 7px;
      transition: color 0.18s;
      position: relative; z-index: 1;
      letter-spacing: 0.01em;
    }
    .tab-btn--active { color: var(--text-primary, #E0E4F0); }
    .tab-indicator {
      position: absolute;
      top: 3px; bottom: 3px;
      width: calc(33.333% - 2px);
      left: 3px;
      background: var(--bg-surface, rgba(255,255,255,0.09));
      border-radius: 7px;
      transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
      pointer-events: none;
    }

    /* ── Swipeable viewport ──────────────────────────────────── */
    .tabs-viewport {
      flex: 1;
      overflow: hidden;
      margin-top: 14px;
      touch-action: pan-y;
    }
    .tabs-track {
      display: flex;
      width: 300%;
      height: 100%;
      transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
    }
    .tab-panel {
      width: 33.333%;
      flex-shrink: 0;
      overflow-y: auto;
      padding: 0 18px 40px;
      -webkit-overflow-scrolling: touch;
    }

    /* ── Models tab ─────────────────────────────────────────── */
    .section-label {
      font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--text-muted, #6A7290);
      margin-bottom: 10px;
    }

    .model-empty {
      display: flex; flex-direction: column; align-items: center;
      padding: 48px 16px 24px; gap: 10px; text-align: center;
    }
    .model-empty-art { margin-bottom: 6px; }
    .model-empty-text {
      font-size: 0.95rem; font-weight: 600;
      color: var(--text-primary, #E0E4F0); margin: 0;
    }
    .model-empty-hint {
      font-size: 0.78rem; color: var(--text-muted, #6A7290);
      margin: 0; max-width: 220px; line-height: 1.5;
    }
    .model-add-btn {
      display: inline-flex; align-items: center; gap: 6px;
      margin-top: 8px; padding: 9px 18px; border-radius: 9px;
      font-size: 0.84rem; font-weight: 600;
      background: rgba(167,139,250,0.12);
      border: 1px solid rgba(167,139,250,0.3);
      color: #a78bfa; cursor: pointer;
      transition: background 0.15s;
    }
    .model-add-btn:hover { background: rgba(167,139,250,0.2); }

    .model-connected { padding-top: 4px; }
    .model-card {
      display: flex; align-items: center; gap: 12px;
      padding: 14px; border-radius: 12px;
      background: var(--bg-card, rgba(255,255,255,0.04));
      border: 1px solid var(--border-light, rgba(255,255,255,0.08));
      margin-bottom: 10px;
    }
    .model-card-icon {
      width: 40px; height: 40px; border-radius: 10px;
      background: rgba(154,230,180,0.1);
      display: flex; align-items: center; justify-content: center;
      color: #68d391; flex-shrink: 0;
    }
    .model-card-info { flex: 1; min-width: 0; }
    .model-card-name {
      display: block; font-size: 0.9rem; font-weight: 700;
      color: var(--text-primary, #E0E4F0);
    }
    .model-card-model {
      display: block; font-size: 0.72rem; font-family: monospace;
      color: var(--text-muted, #6A7290); margin-top: 2px;
    }
    .model-card-desc {
      display: block; font-size: 0.74rem;
      color: var(--text-secondary, #8090A8); margin-top: 3px;
    }

    .status-badge {
      font-size: 0.68rem; font-weight: 700; letter-spacing: 0.04em;
      padding: 3px 9px; border-radius: 10px; flex-shrink: 0;
    }
    .status-badge--ok { background: rgba(74,222,128,0.13); color: #4ade80; }

    .model-actions { display: flex; gap: 8px; margin-bottom: 0; }
    .model-action-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 13px; border-radius: 8px; font-size: 0.78rem; font-weight: 500;
      background: none; border: 1px solid var(--border, rgba(255,255,255,0.14));
      color: var(--text-secondary, #8090A8); cursor: pointer;
      transition: background 0.12s, color 0.12s;
    }
    .model-action-btn:hover {
      background: var(--bg-surface, rgba(255,255,255,0.07));
      color: var(--text-primary, #E0E4F0);
    }

    .feature-chip-list {
      display: flex; flex-wrap: wrap; gap: 8px;
    }
    .feature-chip {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 5px 10px; border-radius: 7px; font-size: 0.76rem; font-weight: 500;
      background: var(--bg-card, rgba(255,255,255,0.04));
      border: 1px solid var(--border-light, rgba(255,255,255,0.08));
      color: var(--text-secondary, #8090A8);
    }

    /* Choose provider */
    .choose-provider { padding-top: 4px; display: flex; flex-direction: column; gap: 12px; }
    .provider-card {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px; border-radius: 12px; cursor: pointer;
      background: var(--bg-card, rgba(255,255,255,0.04));
      border: 1px solid var(--border-light, rgba(255,255,255,0.1));
      color: inherit; text-align: left;
      transition: background 0.15s, border-color 0.15s;
    }
    .provider-card:hover {
      background: var(--bg-surface, rgba(255,255,255,0.07));
      border-color: var(--border, rgba(255,255,255,0.2));
    }
    .provider-card-icon {
      width: 44px; height: 44px; border-radius: 11px;
      background: rgba(154,230,180,0.1);
      display: flex; align-items: center; justify-content: center;
      color: #68d391; flex-shrink: 0;
    }
    .provider-card-icon--sm { width: 32px; height: 32px; border-radius: 8px; }
    .provider-card-info { flex: 1; min-width: 0; }
    .provider-card-name { display: block; font-size: 0.9rem; font-weight: 700; }
    .provider-card-desc { display: block; font-size: 0.74rem; color: var(--text-muted, #6A7290); margin-top: 3px; }
    .back-btn {
      background: none; border: none;
      color: var(--text-muted, #6A7290); font-size: 0.8rem;
      cursor: pointer; padding: 2px 0; align-self: flex-start;
    }
    .back-btn:hover { color: var(--text-primary, #E0E4F0); }

    /* Key form */
    .key-form { display: flex; flex-direction: column; gap: 12px; padding-top: 4px; }
    .key-form-header { display: flex; align-items: center; gap: 10px; }
    .key-form-title { font-size: 0.95rem; font-weight: 700; }
    .key-row { display: flex; gap: 6px; }
    .key-input {
      flex: 1; padding: 9px 11px;
      background: var(--bg-surface, rgba(255,255,255,0.06));
      border: 1px solid var(--border-light, rgba(255,255,255,0.12));
      border-radius: 8px; color: inherit; font-size: 0.84rem; font-family: monospace;
      transition: border-color 0.15s;
    }
    .key-input:focus { outline: none; border-color: var(--border, rgba(255,255,255,0.3)); }
    .key-toggle {
      padding: 0 11px;
      background: var(--bg-surface, rgba(255,255,255,0.06));
      border: 1px solid var(--border-light, rgba(255,255,255,0.12));
      border-radius: 8px; color: inherit; cursor: pointer;
      display: flex; align-items: center;
      transition: background 0.12s;
    }
    .key-toggle:hover { background: var(--bg-card, rgba(255,255,255,0.1)); }
    .key-hint { font-size: 0.75rem; color: var(--text-muted, #6A7290); margin: 0; line-height: 1.5; }
    .key-link { color: inherit; opacity: 0.8; }
    .key-link:hover { opacity: 1; }
    .feedback { font-size: 0.79rem; padding: 8px 11px; border-radius: 7px; }
    .feedback--error { background: rgba(248,113,113,0.12); color: #f87171; }
    .feedback--ok    { background: rgba(74,222,128,0.1);  color: #4ade80; }
    .key-form-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding-top: 4px;
    }
    .btn-cancel {
      padding: 8px 15px; border-radius: 8px; font-size: 0.82rem; font-weight: 500;
      background: none; border: 1px solid var(--border-light, rgba(255,255,255,0.12));
      color: var(--text-muted, #8090A8); cursor: pointer;
      transition: background 0.12s;
    }
    .btn-cancel:hover { background: var(--bg-surface, rgba(255,255,255,0.06)); }
    .btn-save {
      padding: 8px 18px; border-radius: 8px; font-size: 0.82rem; font-weight: 600;
      background: var(--accent-bright, #a78bfa);
      color: #fff; border: none; cursor: pointer;
      transition: opacity 0.15s;
    }
    .btn-save:hover:not(:disabled) { opacity: 0.85; }
    .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Coming-soon panels ─────────────────────────────────── */
    .tab-panel--soon {
      display: flex; align-items: center; justify-content: center;
    }
    .soon-container {
      display: flex; flex-direction: column; align-items: center;
      gap: 14px; text-align: center; padding: 24px 16px;
      max-width: 280px;
    }
    .soon-anim { height: 90px; display: flex; align-items: flex-end; justify-content: center; }
    .pot-wrap { position: relative; width: 64px; }
    .pot-svg { display: block; }

    /* steam strands */
    .steam {
      position: absolute;
      bottom: 100%; left: 50%;
      width: 4px; height: 22px;
      border-radius: 2px;
      background: linear-gradient(to top, rgba(167,139,250,0.5), transparent);
      transform-origin: bottom center;
      animation: steamRise 1.8s ease-in-out infinite;
    }
    .steam--blue {
      background: linear-gradient(to top, rgba(99,179,237,0.5), transparent);
    }
    .steam-1 { left: calc(50% - 12px); animation-delay: 0s;   animation-duration: 1.9s; }
    .steam-2 { left: 50%;             animation-delay: 0.55s; animation-duration: 1.6s; }
    .steam-3 { left: calc(50% + 12px); animation-delay: 1.1s; animation-duration: 2.0s; }

    @keyframes steamRise {
      0%   { opacity: 0;   transform: translateY(0)   scaleX(1);   }
      20%  { opacity: 0.7; }
      80%  { opacity: 0.3; transform: translateY(-20px) scaleX(1.4); }
      100% { opacity: 0;   transform: translateY(-28px) scaleX(0.8); }
    }

    .soon-title {
      font-size: 1rem; font-weight: 700; margin: 0;
      color: var(--text-primary, #E0E4F0);
    }
    .soon-text {
      font-size: 0.78rem; color: var(--text-muted, #6A7290);
      margin: 0; line-height: 1.6;
    }
    .soon-dots { display: flex; gap: 6px; }
    .soon-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: rgba(167,139,250,0.5);
      animation: dotPulse 1.4s ease-in-out infinite;
    }
    .soon-dot--blue { background: rgba(99,179,237,0.5); }
    .soon-dot--1 { animation-delay: 0s; }
    .soon-dot--2 { animation-delay: 0.22s; }
    .soon-dot--3 { animation-delay: 0.44s; }
    @keyframes dotPulse {
      0%, 100% { opacity: 0.3; transform: scale(0.85); }
      50%       { opacity: 1;   transform: scale(1.15); }
    }

    /* ── Mobile tweaks ───────────────────────────────────────── */
    @media (max-width: 400px) {
      .intel-header { padding: 16px 14px 10px; }
      .tab-bar { margin: 0 14px; }
      .tab-panel { padding: 0 14px 40px; }
    }
  `]
})
export class IntelligenceComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  activeTab: IntelTab = 'models';
  get tabIndex(): number { return TABS.indexOf(this.activeTab); }

  geminiConfigured = false;
  intelStep: IntelStep = 'list';
  apiKeyInput  = '';
  showKey      = false;
  saving       = false;
  intelErrorMsg   = '';
  intelSuccessMsg = '';

  private touchStartX = 0;

  constructor(
    private configService: ConfigService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.configService.getConfig().pipe(takeUntil(this.destroy$)).subscribe({
      next: cfg => { this.geminiConfigured = cfg.geminiConfigured; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setTab(tab: IntelTab): void {
    this.activeTab = tab;
    if (tab === 'models') {
      this.intelStep       = 'list';
      this.apiKeyInput     = '';
      this.intelErrorMsg   = '';
      this.intelSuccessMsg = '';
    }
  }

  onTouchStart(e: TouchEvent): void {
    this.touchStartX = e.changedTouches[0].clientX;
  }

  onTouchEnd(e: TouchEvent): void {
    const diff = this.touchStartX - e.changedTouches[0].clientX;
    const idx  = this.tabIndex;
    if (diff >  50 && idx < TABS.length - 1) this.activeTab = TABS[idx + 1];
    if (diff < -50 && idx > 0)               this.activeTab = TABS[idx - 1];
    this.cdr.markForCheck();
  }

  cancelIntelKey(): void {
    this.intelStep       = 'list';
    this.apiKeyInput     = '';
    this.intelErrorMsg   = '';
    this.intelSuccessMsg = '';
  }

  saveKey(): void {
    if (this.saving || !this.apiKeyInput.trim()) return;
    this.saving = true;
    this.intelErrorMsg   = '';
    this.intelSuccessMsg = '';
    this.configService.saveGeminiKey(this.apiKeyInput.trim()).pipe(takeUntil(this.destroy$)).subscribe({
      next: res => {
        this.saving           = false;
        this.geminiConfigured = true;
        this.intelSuccessMsg  = res.message;
        this.apiKeyInput      = '';
        this.cdr.markForCheck();
        setTimeout(() => {
          this.intelSuccessMsg = '';
          this.intelStep = 'list';
          this.cdr.markForCheck();
        }, 2000);
      },
      error: err => {
        this.saving = false;
        this.intelErrorMsg = err.error?.error || 'Failed to verify API key.';
        this.cdr.markForCheck();
      }
    });
  }
}
