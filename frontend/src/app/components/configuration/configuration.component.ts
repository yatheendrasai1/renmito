import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ConfigService } from '../../services/config.service';
import { PreferenceService, DaySettings } from '../../services/preference.service';
import { LogTypeService } from '../../services/log-type.service';
import { LogType } from '../../models/log-type.model';
import { ThemeEditorComponent } from '../theme-editor/theme-editor.component';

const DEFAULT_DAY_SETTINGS: DaySettings = {
  wakeTarget:      '06:30',
  breakfastTarget: '08:00',
  lunchTarget:     '13:00',
  dinnerTarget:    '20:00',
  workStart:       '09:00',
  workEnd:         '18:00',
  commuteStart:    '08:30',
  officeReach:     '09:00',
  officeLeave:     '18:00',
  homeReach:       '19:00',
  bedtimeTarget:   '23:00',
};

type AccordionSection = 'preferences' | 'intelligence' | 'theming' | null;
type IntelStep = 'list' | 'choose' | 'gemini-key';

@Component({
  selector: 'app-configuration',
  standalone: true,
  imports: [CommonModule, FormsModule, ThemeEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cfg-page">
      <div class="cfg-page-header">
        <h2 class="cfg-page-title">Configurations</h2>
        <p class="cfg-page-sub">Manage your preferences and integrations.</p>
      </div>

      <!-- ── Preferences accordion ─────────────────────────────── -->
      <div class="acc" [class.acc--open]="openSection === 'preferences'">
        <button class="acc-head" (click)="toggleSection('preferences')" type="button">
          <div class="acc-icon acc-icon--pref">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div class="acc-meta">
            <span class="acc-title">Preferences</span>
            <span class="acc-sub">Ideal day targets &amp; custom log types</span>
          </div>
          <svg class="acc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <div class="acc-body" *ngIf="openSection === 'preferences'">

          <!-- My Ideal Day -->
          <div class="pref-section">
            <div class="pref-section-label">My Ideal Day</div>
            <div class="ideal-group">
              <div class="ideal-group-label">Daily routine</div>
              <div class="ideal-grid">
                <div class="ideal-field"><label class="ideal-label">Wake up</label>
                  <input class="ideal-input" type="time" [(ngModel)]="idealDayDraft.wakeTarget"/></div>
                <div class="ideal-field"><label class="ideal-label">Breakfast</label>
                  <input class="ideal-input" type="time" [(ngModel)]="idealDayDraft.breakfastTarget"/></div>
                <div class="ideal-field"><label class="ideal-label">Lunch</label>
                  <input class="ideal-input" type="time" [(ngModel)]="idealDayDraft.lunchTarget"/></div>
                <div class="ideal-field"><label class="ideal-label">Dinner</label>
                  <input class="ideal-input" type="time" [(ngModel)]="idealDayDraft.dinnerTarget"/></div>
                <div class="ideal-field"><label class="ideal-label">Sleep</label>
                  <input class="ideal-input" type="time" [(ngModel)]="idealDayDraft.bedtimeTarget"/></div>
              </div>
            </div>
            <div class="ideal-group">
              <div class="ideal-group-label">Office work</div>
              <div class="ideal-grid">
                <div class="ideal-field"><label class="ideal-label">Start work</label>
                  <input class="ideal-input" type="time" [(ngModel)]="idealDayDraft.workStart"/></div>
                <div class="ideal-field"><label class="ideal-label">End work</label>
                  <input class="ideal-input" type="time" [(ngModel)]="idealDayDraft.workEnd"/></div>
              </div>
            </div>
            <div class="ideal-group">
              <div class="ideal-group-label">Commute to office</div>
              <div class="ideal-grid">
                <div class="ideal-field"><label class="ideal-label">Leave home</label>
                  <input class="ideal-input" type="time" [(ngModel)]="idealDayDraft.commuteStart"/></div>
                <div class="ideal-field"><label class="ideal-label">Reach office</label>
                  <input class="ideal-input" type="time" [(ngModel)]="idealDayDraft.officeReach"/></div>
              </div>
            </div>
            <div class="ideal-group">
              <div class="ideal-group-label">Commute home</div>
              <div class="ideal-grid">
                <div class="ideal-field"><label class="ideal-label">Leave office</label>
                  <input class="ideal-input" type="time" [(ngModel)]="idealDayDraft.officeLeave"/></div>
                <div class="ideal-field"><label class="ideal-label">Reach home</label>
                  <input class="ideal-input" type="time" [(ngModel)]="idealDayDraft.homeReach"/></div>
              </div>
            </div>
            <div class="cfg-feedback cfg-feedback--error" *ngIf="idealErrorMsg">{{ idealErrorMsg }}</div>
            <div class="cfg-feedback cfg-feedback--ok"    *ngIf="idealSuccessMsg">{{ idealSuccessMsg }}</div>
          </div>

          <!-- Custom Log Types -->
          <div class="pref-section">
            <div class="pref-section-label">Custom Log Types</div>
            <div class="lt-list" *ngIf="customLogTypes.length > 0">
              <div class="lt-row" *ngFor="let lt of customLogTypes; trackBy: trackByLogTypeId">
                <div class="lt-color-dot" [style.background]="lt.color || '#888'"></div>
                <span class="lt-name" *ngIf="editingLtId !== lt._id">{{ lt.name }}</span>
                <input *ngIf="editingLtId === lt._id" class="lt-name-input"
                       [(ngModel)]="editingLtName" (keydown.enter)="saveEditLt(lt)"
                       (keydown.escape)="cancelEditLt()" />
                <span class="lt-domain">{{ lt.domain }}</span>
                <div class="lt-actions">
                  <button *ngIf="editingLtId !== lt._id" class="lt-btn" (click)="startEditLt(lt)" title="Rename">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button *ngIf="editingLtId === lt._id" class="lt-btn lt-btn--save" (click)="saveEditLt(lt)">Save</button>
                  <button *ngIf="editingLtId === lt._id" class="lt-btn" (click)="cancelEditLt()">✕</button>
                  <button class="lt-btn lt-btn--del" (click)="deleteLt(lt)" title="Delete">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14H6L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div class="lt-empty" *ngIf="customLogTypes.length === 0 && !showNewLtForm">
              No custom log types yet.
            </div>

            <div class="lt-new-form" *ngIf="showNewLtForm">
              <input class="lt-name-input" [(ngModel)]="newLt.name" placeholder="Name" maxlength="40"/>
              <select class="lt-domain-select" [(ngModel)]="newLt.domain">
                <option value="work">Work</option>
                <option value="personal">Personal</option>
                <option value="family">Family</option>
              </select>
              <div class="lt-new-actions">
                <button class="lt-btn" (click)="showNewLtForm = false">Cancel</button>
                <button class="lt-btn lt-btn--save" (click)="createLt()" [disabled]="!newLt.name.trim()">Add</button>
              </div>
            </div>

            <button class="lt-add-btn" *ngIf="!showNewLtForm" (click)="openNewLtForm()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New type
            </button>
          </div>

          <!-- Accordion footer -->
          <div class="acc-footer">
            <button class="acc-cancel-btn" (click)="cancelPreferences()" type="button">Cancel</button>
            <button class="acc-save-btn" (click)="savePreferences()"
                    [disabled]="savingPreferences" type="button">
              {{ savingPreferences ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ── Intelligence accordion ─────────────────────────────── -->
      <div class="acc" [class.acc--open]="openSection === 'intelligence'">
        <button class="acc-head" (click)="toggleSection('intelligence')" type="button">
          <div class="acc-icon acc-icon--intel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
          </div>
          <div class="acc-meta">
            <span class="acc-title">Intelligence</span>
            <span class="acc-sub">AI integrations for log assistance</span>
          </div>
          <span class="acc-badge acc-badge--ok" *ngIf="geminiConfigured">Connected</span>
          <svg class="acc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <div class="acc-body" *ngIf="openSection === 'intelligence'">

          <!-- No integrations yet -->
          <div class="intel-empty" *ngIf="!geminiConfigured && intelStep === 'list'">
            <div class="intel-empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
            </div>
            <p class="intel-empty-text">No intelligence configured</p>
            <button class="intel-add-btn" (click)="intelStep = 'choose'" type="button">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Intelligence
            </button>
          </div>

          <!-- Already connected -->
          <div class="intel-connected" *ngIf="geminiConfigured && intelStep === 'list'">
            <div class="intel-item">
              <div class="intel-item-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div class="intel-item-info">
                <span class="intel-item-name">Google Gemini</span>
                <span class="intel-item-desc">Powers the Renni AI assistant</span>
              </div>
              <span class="acc-badge acc-badge--ok">Connected</span>
              <button class="intel-update-btn" (click)="intelStep = 'gemini-key'" type="button">Update key</button>
            </div>
          </div>

          <!-- Choose provider -->
          <div class="intel-choose" *ngIf="intelStep === 'choose'">
            <div class="intel-choose-label">Choose a provider</div>
            <button class="intel-provider-card" (click)="intelStep = 'gemini-key'" type="button">
              <div class="intel-provider-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div class="intel-provider-info">
                <span class="intel-provider-name">Google Gemini</span>
                <span class="intel-provider-desc">Fast, multimodal AI from Google</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            <button class="intel-back-btn" (click)="intelStep = 'list'" type="button">← Back</button>
          </div>

          <!-- Gemini key entry -->
          <div class="intel-key-form" *ngIf="intelStep === 'gemini-key'">
            <div class="intel-key-header">
              <div class="intel-item-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <span class="intel-key-title">Gemini API Key</span>
            </div>
            <div class="cfg-key-row">
              <input class="cfg-key-input"
                     [type]="showKey ? 'text' : 'password'"
                     [(ngModel)]="apiKeyInput"
                     placeholder="AIza…"
                     autocomplete="off"
                     spellcheck="false"/>
              <button class="cfg-key-toggle" (click)="showKey = !showKey" type="button">
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
            <p class="cfg-hint">
              Get your key from
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" class="cfg-link">Google AI Studio</a>.
              The key is verified before saving.
            </p>
            <div class="cfg-feedback cfg-feedback--error" *ngIf="intelErrorMsg">{{ intelErrorMsg }}</div>
            <div class="cfg-feedback cfg-feedback--ok"    *ngIf="intelSuccessMsg">{{ intelSuccessMsg }}</div>
            <div class="acc-footer">
              <button class="acc-cancel-btn" (click)="cancelIntelKey()" type="button">Cancel</button>
              <button class="acc-save-btn" (click)="saveKey()"
                      [disabled]="saving || !apiKeyInput.trim()" type="button">
                {{ saving ? 'Verifying…' : 'Verify & Save' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Theming accordion ───────────────────────────────────── -->
      <div class="acc" [class.acc--open]="openSection === 'theming'">
        <button class="acc-head" (click)="toggleSection('theming')" type="button">
          <div class="acc-icon acc-icon--theme">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="13.5" cy="6.5" r="2.5"/>
              <circle cx="19"   cy="13"  r="2.5"/>
              <circle cx="6"    cy="13"  r="2.5"/>
              <circle cx="10"   cy="19"  r="2.5"/>
            </svg>
          </div>
          <div class="acc-meta">
            <span class="acc-title">Theming</span>
            <span class="acc-sub">Color palette and visual style</span>
          </div>
          <svg class="acc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <div class="acc-body acc-body--theme" *ngIf="openSection === 'theming'">
          <app-theme-editor [inline]="true"></app-theme-editor>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ── Page shell ─────────────────────────────────────────── */
    .cfg-page {
      padding: 20px 16px 40px;
      max-width: 640px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .cfg-page-header { margin-bottom: 8px; }
    .cfg-page-title { font-size: 1.05rem; font-weight: 700; margin: 0 0 3px; color: var(--text-primary, #E0E4F0); }
    .cfg-page-sub   { font-size: 0.8rem; margin: 0; color: var(--text-muted, #6A7290); }

    /* ── Accordion group ─────────────────────────────────────── */
    .acc {
      border-radius: 12px;
      border: 1px solid var(--border-light, rgba(255,255,255,0.08));
      background: var(--bg-card, rgba(255,255,255,0.04));
      overflow: hidden;
      transition: border-color 0.2s;
    }
    .acc--open {
      border-color: var(--border, rgba(255,255,255,0.14));
    }

    /* ── Accordion header ────────────────────────────────────── */
    .acc-head {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-primary, #E0E4F0);
      text-align: left;
      transition: background 0.15s;
    }
    .acc-head:hover { background: var(--bg-surface, rgba(255,255,255,0.03)); }

    .acc-icon {
      width: 34px; height: 34px;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .acc-icon--pref  { background: rgba(99,179,237,0.12); color: #63b3ed; }
    .acc-icon--intel { background: rgba(154,230,180,0.12); color: #68d391; }
    .acc-icon--theme { background: rgba(183,148,244,0.12); color: #b794f4; }

    .acc-meta { flex: 1; min-width: 0; }
    .acc-title { display: block; font-size: 0.88rem; font-weight: 600; }
    .acc-sub   { display: block; font-size: 0.74rem; color: var(--text-muted, #6A7290); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .acc-badge {
      font-size: 0.7rem; font-weight: 700; letter-spacing: 0.04em;
      padding: 2px 8px; border-radius: 10px; flex-shrink: 0;
    }
    .acc-badge--ok { background: rgba(74,222,128,0.13); color: #4ade80; }

    .acc-chevron {
      flex-shrink: 0;
      transition: transform 0.22s ease;
      color: var(--text-muted, #6A7290);
    }
    .acc--open .acc-chevron { transform: rotate(180deg); }

    /* ── Accordion body ──────────────────────────────────────── */
    .acc-body {
      border-top: 1px solid var(--border-light, rgba(255,255,255,0.07));
      display: flex;
      flex-direction: column;
      gap: 0;
      animation: bodyIn 0.18s ease;
    }
    @keyframes bodyIn {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Preferences sections ────────────────────────────────── */
    .pref-section {
      padding: 16px 16px 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .pref-section + .pref-section { padding-top: 14px; border-top: 1px solid var(--border-light, rgba(255,255,255,0.06)); margin-top: 4px; }
    .pref-section-label {
      font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--text-muted, #6A7290);
    }

    .ideal-group { display: flex; flex-direction: column; gap: 8px; }
    .ideal-group-label {
      font-size: 0.71rem; font-weight: 600; letter-spacing: 0.05em;
      text-transform: uppercase; opacity: 0.45;
    }
    .ideal-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
    .ideal-field { display: flex; flex-direction: column; gap: 4px; }
    .ideal-label { font-size: 0.74rem; font-weight: 500; color: var(--text-secondary, #8090A8); }
    .ideal-input {
      padding: 7px 9px;
      background: var(--bg-surface, rgba(255,255,255,0.06));
      border: 1px solid var(--border-light, rgba(255,255,255,0.1));
      border-radius: 7px; color: inherit; font-size: 0.83rem;
      color-scheme: dark;
      transition: border-color 0.15s;
    }
    .ideal-input:focus { outline: none; border-color: var(--border, rgba(255,255,255,0.28)); }

    /* ── Custom log types ────────────────────────────────────── */
    .lt-list { display: flex; flex-direction: column; gap: 4px; }
    .lt-row {
      display: flex; align-items: center; gap: 8px;
      padding: 7px 10px; border-radius: 8px;
      background: var(--bg-surface, rgba(255,255,255,0.04));
      border: 1px solid var(--border-light, rgba(255,255,255,0.07));
    }
    .lt-color-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .lt-name { flex: 1; font-size: 0.84rem; font-weight: 500; }
    .lt-domain { font-size: 0.7rem; color: var(--text-muted, #6A7290); text-transform: capitalize; }
    .lt-actions { display: flex; gap: 4px; margin-left: 4px; }
    .lt-btn {
      padding: 3px 7px; border-radius: 5px; font-size: 0.76rem; font-weight: 500;
      border: 1px solid var(--border-light, rgba(255,255,255,0.1));
      background: var(--bg-card, rgba(255,255,255,0.04));
      color: var(--text-secondary, #8090A8); cursor: pointer;
      display: flex; align-items: center; gap: 3px;
      transition: background 0.12s;
    }
    .lt-btn:hover { background: var(--bg-surface, rgba(255,255,255,0.1)); }
    .lt-btn--save { color: #4ade80; border-color: rgba(74,222,128,0.25); }
    .lt-btn--del  { color: #f87171; border-color: rgba(248,113,113,0.2); }
    .lt-btn--del:hover { background: rgba(248,113,113,0.1); }
    .lt-name-input {
      flex: 1; padding: 5px 8px;
      background: var(--bg-surface, rgba(255,255,255,0.06));
      border: 1px solid var(--border, rgba(255,255,255,0.2));
      border-radius: 5px; color: inherit; font-size: 0.83rem;
    }
    .lt-name-input:focus { outline: none; }
    .lt-empty { font-size: 0.8rem; color: var(--text-muted, #6A7290); padding: 4px 0; }
    .lt-new-form { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .lt-domain-select {
      padding: 5px 8px; border-radius: 6px; font-size: 0.8rem;
      background: var(--bg-surface, rgba(255,255,255,0.06));
      border: 1px solid var(--border-light, rgba(255,255,255,0.1));
      color: inherit;
    }
    .lt-new-actions { display: flex; gap: 4px; }
    .lt-add-btn {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 5px 10px; border-radius: 7px; font-size: 0.78rem; font-weight: 600;
      background: none; border: 1px dashed var(--border, rgba(255,255,255,0.18));
      color: var(--text-muted, #6A7290); cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .lt-add-btn:hover { background: var(--bg-surface, rgba(255,255,255,0.05)); color: var(--text-primary, #E0E4F0); }

    /* ── Intelligence states ─────────────────────────────────── */
    .intel-empty {
      padding: 28px 16px;
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      text-align: center;
    }
    .intel-empty-icon { opacity: 0.5; }
    .intel-empty-text { font-size: 0.84rem; color: var(--text-muted, #6A7290); margin: 0; }
    .intel-add-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; border-radius: 8px; font-size: 0.83rem; font-weight: 600;
      background: rgba(99,179,237,0.1); border: 1px solid rgba(99,179,237,0.25);
      color: #63b3ed; cursor: pointer; transition: background 0.15s;
    }
    .intel-add-btn:hover { background: rgba(99,179,237,0.18); }

    .intel-connected { padding: 12px 16px; }
    .intel-item {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; border-radius: 9px;
      background: var(--bg-surface, rgba(255,255,255,0.04));
      border: 1px solid var(--border-light, rgba(255,255,255,0.07));
    }
    .intel-item-icon {
      width: 34px; height: 34px; border-radius: 8px;
      background: rgba(154,230,180,0.1);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      color: #68d391;
    }
    .intel-item-info { flex: 1; min-width: 0; }
    .intel-item-name { display: block; font-size: 0.86rem; font-weight: 600; }
    .intel-item-desc { display: block; font-size: 0.73rem; color: var(--text-muted, #6A7290); }
    .intel-update-btn {
      padding: 5px 10px; border-radius: 6px; font-size: 0.76rem; font-weight: 500;
      background: none; border: 1px solid var(--border, rgba(255,255,255,0.15));
      color: var(--text-secondary, #8090A8); cursor: pointer; transition: background 0.12s;
    }
    .intel-update-btn:hover { background: var(--bg-surface, rgba(255,255,255,0.08)); }

    .intel-choose { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .intel-choose-label { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--text-muted, #6A7290); }
    .intel-provider-card {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px; border-radius: 10px; cursor: pointer;
      background: var(--bg-surface, rgba(255,255,255,0.04));
      border: 1px solid var(--border-light, rgba(255,255,255,0.1));
      color: inherit; text-align: left;
      transition: background 0.15s, border-color 0.15s;
    }
    .intel-provider-card:hover { background: var(--bg-card, rgba(255,255,255,0.07)); border-color: var(--border, rgba(255,255,255,0.2)); }
    .intel-provider-icon {
      width: 40px; height: 40px; border-radius: 10px;
      background: rgba(154,230,180,0.1);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      color: #68d391;
    }
    .intel-provider-info { flex: 1; }
    .intel-provider-name { display: block; font-size: 0.88rem; font-weight: 600; }
    .intel-provider-desc { display: block; font-size: 0.74rem; color: var(--text-muted, #6A7290); margin-top: 2px; }
    .intel-back-btn {
      background: none; border: none; color: var(--text-muted, #6A7290);
      font-size: 0.78rem; cursor: pointer; padding: 0;
      align-self: flex-start;
    }
    .intel-back-btn:hover { color: var(--text-primary, #E0E4F0); }

    .intel-key-form { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .intel-key-header { display: flex; align-items: center; gap: 10px; }
    .intel-key-title { font-size: 0.9rem; font-weight: 600; }

    /* ── Shared form elements ────────────────────────────────── */
    .cfg-key-row { display: flex; gap: 6px; }
    .cfg-key-input {
      flex: 1; padding: 8px 10px;
      background: var(--bg-surface, rgba(255,255,255,0.06));
      border: 1px solid var(--border-light, rgba(255,255,255,0.12));
      border-radius: 7px; color: inherit; font-size: 0.84rem; font-family: monospace;
      transition: border-color 0.15s;
    }
    .cfg-key-input:focus { outline: none; border-color: var(--border, rgba(255,255,255,0.3)); }
    .cfg-key-toggle {
      padding: 0 10px;
      background: var(--bg-surface, rgba(255,255,255,0.06));
      border: 1px solid var(--border-light, rgba(255,255,255,0.12));
      border-radius: 7px; color: inherit; cursor: pointer;
      display: flex; align-items: center;
      transition: background 0.12s;
    }
    .cfg-key-toggle:hover { background: var(--bg-card, rgba(255,255,255,0.1)); }
    .cfg-hint { font-size: 0.75rem; color: var(--text-muted, #6A7290); margin: 0; line-height: 1.5; }
    .cfg-link { color: inherit; opacity: 0.8; }
    .cfg-link:hover { opacity: 1; }
    .cfg-feedback { font-size: 0.79rem; padding: 7px 10px; border-radius: 6px; }
    .cfg-feedback--error { background: rgba(248,113,113,0.12); color: #f87171; }
    .cfg-feedback--ok    { background: rgba(74,222,128,0.1);  color: #4ade80; }

    /* ── Accordion footer (Save / Cancel) ───────────────────── */
    .acc-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 12px 16px 16px;
      margin-top: 4px;
      border-top: 1px solid var(--border-light, rgba(255,255,255,0.06));
    }
    .acc-cancel-btn {
      padding: 7px 14px; border-radius: 7px; font-size: 0.82rem; font-weight: 500;
      background: none; border: 1px solid var(--border-light, rgba(255,255,255,0.12));
      color: var(--text-muted, #8090A8); cursor: pointer;
      transition: background 0.12s;
    }
    .acc-cancel-btn:hover { background: var(--bg-surface, rgba(255,255,255,0.06)); }
    .acc-save-btn {
      padding: 7px 16px; border-radius: 7px; font-size: 0.82rem; font-weight: 600;
      background: var(--accent-bright, #a78bfa);
      color: #fff; border: none; cursor: pointer;
      transition: opacity 0.15s;
    }
    .acc-save-btn:hover:not(:disabled) { opacity: 0.85; }
    .acc-save-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Theming body (no extra padding — ThemeEditor has its own) ── */
    .acc-body--theme { padding: 0; }

    /* ── Mobile ──────────────────────────────────────────────── */
    @media (max-width: 480px) {
      .cfg-page { padding: 14px 12px 40px; }
      .ideal-grid { grid-template-columns: 1fr 1fr; }
      .acc-sub { display: none; }
      .intel-item { flex-wrap: wrap; gap: 8px; }
    }
  `]
})
export class ConfigurationComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  openSection: AccordionSection = null;

  // ── Preferences ───────────────────────────────────────────
  idealDay:      DaySettings = { ...DEFAULT_DAY_SETTINGS };
  idealDayDraft: DaySettings = { ...DEFAULT_DAY_SETTINGS };
  savingPreferences = false;
  idealErrorMsg   = '';
  idealSuccessMsg = '';

  customLogTypes: LogType[] = [];
  editingLtId   = '';
  editingLtName = '';
  showNewLtForm = false;
  newLt = { name: '', domain: 'personal' as 'work' | 'personal' | 'family' };

  // ── Intelligence ──────────────────────────────────────────
  geminiConfigured = false;
  intelStep: IntelStep = 'list';
  apiKeyInput  = '';
  showKey      = false;
  saving       = false;
  intelErrorMsg   = '';
  intelSuccessMsg = '';

  constructor(
    private configService: ConfigService,
    private prefService:   PreferenceService,
    private ltService:     LogTypeService,
    private cdr:           ChangeDetectorRef,
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.configService.getConfig().pipe(takeUntil(this.destroy$)).subscribe({
      next: cfg => { this.geminiConfigured = cfg.geminiConfigured; this.cdr.markForCheck(); },
      error: () => {}
    });
    this.prefService.getPreferences().pipe(takeUntil(this.destroy$)).subscribe({
      next: prefs => {
        if (prefs?.daySettings) {
          this.idealDay = { ...DEFAULT_DAY_SETTINGS, ...prefs.daySettings };
        }
        this.cdr.markForCheck();
      },
      error: () => {}
    });
    this.loadCustomLogTypes();
  }

  toggleSection(section: NonNullable<AccordionSection>): void {
    if (this.openSection === section) {
      this.openSection = null;
      return;
    }
    this.openSection = section;
    if (section === 'preferences') {
      this.idealDayDraft = { ...this.idealDay };
      this.idealErrorMsg   = '';
      this.idealSuccessMsg = '';
    }
    if (section === 'intelligence') {
      this.intelStep      = 'list';
      this.apiKeyInput    = '';
      this.intelErrorMsg  = '';
      this.intelSuccessMsg = '';
    }
  }

  // ── Preferences ───────────────────────────────────────────
  cancelPreferences(): void {
    this.idealDayDraft   = { ...this.idealDay };
    this.idealErrorMsg   = '';
    this.idealSuccessMsg = '';
    this.openSection = null;
  }

  savePreferences(): void {
    if (this.savingPreferences) return;
    this.savingPreferences = true;
    this.idealErrorMsg   = '';
    this.idealSuccessMsg = '';
    this.prefService.updateDaySettings(this.idealDayDraft).pipe(takeUntil(this.destroy$)).subscribe({
      next: saved => {
        this.savingPreferences = false;
        if (saved) {
          this.idealDay      = { ...DEFAULT_DAY_SETTINGS, ...saved };
          this.idealDayDraft = { ...this.idealDay };
          this.idealSuccessMsg = 'Saved.';
          this.cdr.markForCheck();
          setTimeout(() => { this.idealSuccessMsg = ''; this.cdr.markForCheck(); }, 2500);
        } else {
          this.idealErrorMsg = 'Could not save. Please try again.';
          this.cdr.markForCheck();
        }
      },
      error: () => {
        this.savingPreferences = false;
        this.idealErrorMsg = 'Could not save. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  // ── Custom log types ──────────────────────────────────────
  private loadCustomLogTypes(): void {
    this.ltService.getLogTypes().pipe(takeUntil(this.destroy$)).subscribe({
      next: types => { this.customLogTypes = types.filter(t => t.source === 'user'); this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  startEditLt(lt: LogType): void {
    this.editingLtId   = lt._id;
    this.editingLtName = lt.name;
  }

  cancelEditLt(): void {
    this.editingLtId   = '';
    this.editingLtName = '';
  }

  saveEditLt(lt: LogType): void {
    const name = this.editingLtName.trim();
    if (!name) return;
    this.ltService.updateLogTypeName(lt._id, name).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { lt.name = name; this.cancelEditLt(); this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  deleteLt(lt: LogType): void {
    this.ltService.deleteLogType(lt._id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.customLogTypes = this.customLogTypes.filter(t => t._id !== lt._id); this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  openNewLtForm(): void {
    this.newLt = { name: '', domain: 'personal' };
    this.showNewLtForm = true;
  }

  createLt(): void {
    if (!this.newLt.name.trim()) return;
    this.ltService.createLogType({ name: this.newLt.name.trim(), domain: this.newLt.domain }).pipe(takeUntil(this.destroy$)).subscribe({
      next: lt => {
        this.customLogTypes.push(lt);
        this.showNewLtForm = false;
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  // ── Intelligence ──────────────────────────────────────────
  cancelIntelKey(): void {
    this.intelStep   = this.geminiConfigured ? 'list' : 'list';
    this.apiKeyInput = '';
    this.intelErrorMsg  = '';
    this.intelSuccessMsg = '';
  }

  saveKey(): void {
    if (this.saving || !this.apiKeyInput.trim()) return;
    this.saving = true;
    this.intelErrorMsg  = '';
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

  trackByLogTypeId(_i: number, lt: LogType): string { return lt._id; }
}
