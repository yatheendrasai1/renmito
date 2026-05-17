import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ExpenseService, Expense, CreateExpensePayload } from '../../services/expense.service';

const CATEGORIES = ['Uncategorized', 'Food & Dining', 'Transport', 'Shopping', 'Entertainment', 'Bills & Utilities', 'Health', 'Travel', 'Education', 'Other'];
const PAY_METHODS = ['', 'UPI', 'Debit Card', 'Credit Card', 'Net Banking', 'Cash', 'Wallet'];

@Component({
  selector: 'app-expense-guide-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ege-page">

      <!-- Header -->
      <div class="ege-header">
        <div class="ege-header-left">
          <h1 class="ege-title">Expenses</h1>
          <span class="ege-count" *ngIf="total > 0">{{ total }}</span>
        </div>
        <button class="ege-add-btn" (click)="openAddForm()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Expense
        </button>
      </div>

      <!-- Filters -->
      <div class="ege-filters">
        <div class="ege-filter-group">
          <input class="ege-filter-input" type="date" [(ngModel)]="filter.startDate" (change)="loadExpenses()" placeholder="From" title="From date"/>
          <span class="ege-filter-sep">–</span>
          <input class="ege-filter-input" type="date" [(ngModel)]="filter.endDate" (change)="loadExpenses()" placeholder="To" title="To date"/>
        </div>
        <div class="ege-filter-tabs">
          <button class="ege-filter-tab" [class.ege-filter-tab--active]="filter.entryType === ''"
                  (click)="setEntryTypeFilter('')">All</button>
          <button class="ege-filter-tab" [class.ege-filter-tab--active]="filter.entryType === 'manual'"
                  (click)="setEntryTypeFilter('manual')">Manual</button>
          <button class="ege-filter-tab" [class.ege-filter-tab--active]="filter.entryType === 'automatic'"
                  (click)="setEntryTypeFilter('automatic')">Auto (SMS)</button>
        </div>
      </div>

      <!-- Summary bar -->
      <div class="ege-summary" *ngIf="expenses.length > 0">
        <span class="ege-summary-label">Total shown</span>
        <span class="ege-summary-amount">{{ currencySymbol }} {{ totalAmount | number:'1.2-2' }}</span>
      </div>

      <!-- Loading -->
      <div class="ege-empty" *ngIf="loading">
        <div class="ege-spinner"></div>
        <span>Loading expenses…</span>
      </div>

      <!-- Empty -->
      <div class="ege-empty" *ngIf="!loading && expenses.length === 0">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
             style="opacity:0.3">
          <line x1="12" y1="1" x2="12" y2="23"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
        <span>No expenses found. Add one or enable SMS tracking.</span>
      </div>

      <!-- List -->
      <div class="ege-list" *ngIf="!loading && expenses.length > 0">
        <div class="ege-item" *ngFor="let e of expenses; trackBy: trackById">
          <div class="ege-item-left">
            <div class="ege-item-dot"
                 [style.background]="e.entryType === 'automatic' ? '#a78bfa' : 'var(--accent)'"></div>
            <div class="ege-item-info">
              <div class="ege-item-merchant">{{ e.merchant || 'Unknown' }}</div>
              <div class="ege-item-meta">
                <span class="ege-item-cat">{{ e.category }}</span>
                <span class="ege-item-sep">·</span>
                <span class="ege-item-date">{{ e.date | date:'d MMM yyyy' }}</span>
                <span class="ege-item-sep" *ngIf="e.paymentMethod">·</span>
                <span class="ege-item-pay" *ngIf="e.paymentMethod">{{ e.paymentMethod }}</span>
                <span class="ege-item-type" [class.ege-item-type--auto]="e.entryType === 'automatic'">
                  {{ e.entryType === 'automatic' ? 'SMS' : 'Manual' }}
                </span>
              </div>
              <div class="ege-item-desc" *ngIf="e.description">{{ e.description }}</div>
              <div class="ege-item-ref" *ngIf="e.referenceId">Ref: {{ e.referenceId }}</div>
            </div>
          </div>
          <div class="ege-item-right">
            <span class="ege-item-amount">{{ currencySymbol }} {{ e.amount | number:'1.2-2' }}</span>
            <div class="ege-item-actions">
              <button class="ege-item-btn" (click)="openEditForm(e)" title="Edit">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="ege-item-btn ege-item-btn--del" (click)="confirmDelete(e)" title="Delete">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div class="ege-pagination" *ngIf="total > limit">
        <button class="ege-page-btn" [disabled]="page <= 1" (click)="goPage(page - 1)">← Prev</button>
        <span class="ege-page-info">{{ page }} / {{ totalPages }}</span>
        <button class="ege-page-btn" [disabled]="page >= totalPages" (click)="goPage(page + 1)">Next →</button>
      </div>

    </div>

    <!-- Add / Edit Form Modal -->
    <div class="ege-modal-backdrop" *ngIf="formOpen" (click)="closeForm()"></div>
    <div class="ege-modal" *ngIf="formOpen" (click)="$event.stopPropagation()">
      <div class="ege-modal-header">
        <span class="ege-modal-title">{{ editingId ? 'Edit Expense' : 'Add Expense' }}</span>
        <button class="ege-modal-close" (click)="closeForm()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="ege-form">
        <div class="ege-form-row">
          <div class="ege-field">
            <label class="ege-field-label">Amount *</label>
            <input class="ege-input" type="number" min="0.01" step="0.01"
                   [(ngModel)]="amountStr" placeholder="0.00"/>
          </div>
          <div class="ege-field">
            <label class="ege-field-label">Date *</label>
            <input class="ege-input" type="date" [(ngModel)]="form.date"/>
          </div>
        </div>

        <div class="ege-field">
          <label class="ege-field-label">Merchant / Payee</label>
          <input class="ege-input" type="text" [(ngModel)]="form.merchant" placeholder="e.g. Swiggy, Amazon"/>
        </div>

        <div class="ege-form-row">
          <div class="ege-field">
            <label class="ege-field-label">Category</label>
            <select class="ege-input" [(ngModel)]="form.category">
              <option *ngFor="let c of categories" [value]="c">{{ c }}</option>
            </select>
          </div>
          <div class="ege-field">
            <label class="ege-field-label">Payment method</label>
            <select class="ege-input" [(ngModel)]="form.paymentMethod">
              <option *ngFor="let m of payMethods" [value]="m">{{ m || 'Not specified' }}</option>
            </select>
          </div>
        </div>

        <div class="ege-field">
          <label class="ege-field-label">Description</label>
          <input class="ege-input" type="text" [(ngModel)]="form.description" placeholder="Optional notes"/>
        </div>

        <div class="ege-field">
          <label class="ege-field-label">Reference / Transaction ID</label>
          <input class="ege-input" type="text" [(ngModel)]="form.referenceId" placeholder="Optional"/>
        </div>

        <div class="ege-form-err" *ngIf="formError">{{ formError }}</div>
      </div>

      <div class="ege-modal-actions">
        <button class="ege-btn ege-btn--ghost" (click)="closeForm()">Cancel</button>
        <button class="ege-btn ege-btn--primary" (click)="submitForm()" [disabled]="!canSubmit">
          {{ formSaving ? 'Saving…' : (editingId ? 'Save changes' : 'Add expense') }}
        </button>
      </div>
    </div>

    <!-- Delete confirm -->
    <div class="ege-modal-backdrop" *ngIf="deleteTarget" (click)="deleteTarget = null"></div>
    <div class="ege-modal ege-modal--sm" *ngIf="deleteTarget">
      <div class="ege-modal-header">
        <span class="ege-modal-title">Delete expense?</span>
      </div>
      <p class="ege-del-msg">
        This will permanently remove the expense of
        <strong>{{ currencySymbol }} {{ deleteTarget.amount | number:'1.2-2' }}</strong>
        at <strong>{{ deleteTarget.merchant || 'Unknown' }}</strong>.
      </p>
      <div class="ege-modal-actions">
        <button class="ege-btn ege-btn--ghost" (click)="deleteTarget = null">Cancel</button>
        <button class="ege-btn ege-btn--danger" (click)="doDelete()" [disabled]="isDeleting">
          {{ isDeleting ? 'Deleting…' : 'Delete' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .ege-page {
      max-width: 700px;
      padding: 20px 0 40px;
      display: flex; flex-direction: column; gap: 14px;
    }
    .ege-header {
      display: flex; align-items: center; justify-content: space-between;
    }
    .ege-header-left { display: flex; align-items: center; gap: 8px; }
    .ege-title {
      font-size: 22px; font-weight: 700;
      color: var(--text-primary); margin: 0;
    }
    .ege-count {
      background: var(--accent); color: #fff;
      font-size: 11px; font-weight: 700;
      padding: 2px 7px; border-radius: 10px;
    }
    .ege-add-btn {
      display: flex; align-items: center; gap: 6px;
      background: var(--accent); color: #fff;
      border: none; border-radius: var(--radius-sm);
      padding: 8px 14px; font-size: 13px; font-weight: 600;
      cursor: pointer;
    }

    .ege-filters {
      display: flex; flex-direction: column; gap: 8px;
    }
    .ege-filter-group {
      display: flex; align-items: center; gap: 6px;
    }
    .ege-filter-input {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 12px; padding: 6px 8px;
      flex: 1;
    }
    .ege-filter-sep { color: var(--text-muted); font-size: 13px; }
    .ege-filter-tabs { display: flex; gap: 4px; }
    .ege-filter-tab {
      padding: 5px 12px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      background: transparent; color: var(--text-secondary);
      font-size: 12px; font-weight: 500; cursor: pointer;
      transition: background 0.12s, color 0.12s;
    }
    .ege-filter-tab--active {
      background: var(--accent); color: #fff; border-color: var(--accent);
    }

    .ege-summary {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .ege-summary-label { font-size: 12px; color: var(--text-secondary); }
    .ege-summary-amount { font-size: 15px; font-weight: 700; color: var(--text-primary); }

    .ege-empty {
      display: flex; flex-direction: column; align-items: center;
      gap: 10px; padding: 40px 20px;
      color: var(--text-muted); font-size: 13px; text-align: center;
    }
    .ege-spinner {
      width: 24px; height: 24px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: egeSpin 0.6s linear infinite;
    }
    @keyframes egeSpin { to { transform: rotate(360deg); } }

    .ege-list { display: flex; flex-direction: column; gap: 6px; }
    .ege-item {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 12px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 12px 14px;
      transition: border-color 0.12s;
    }
    .ege-item:hover { border-color: var(--accent); }
    .ege-item-left { display: flex; align-items: flex-start; gap: 10px; flex: 1; min-width: 0; }
    .ege-item-dot {
      width: 10px; height: 10px; border-radius: 50%;
      margin-top: 4px; flex-shrink: 0;
    }
    .ege-item-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .ege-item-merchant {
      font-size: 14px; font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .ege-item-meta {
      display: flex; align-items: center; flex-wrap: wrap; gap: 4px;
      font-size: 11px; color: var(--text-muted);
    }
    .ege-item-sep { opacity: 0.5; }
    .ege-item-type {
      padding: 1px 6px; border-radius: 8px;
      background: var(--border); color: var(--text-muted);
      font-size: 10px; font-weight: 600;
    }
    .ege-item-type--auto { background: rgba(167,139,250,0.15); color: #a78bfa; }
    .ege-item-desc { font-size: 11px; color: var(--text-muted); }
    .ege-item-ref { font-size: 10px; color: var(--text-muted); opacity: 0.7; }

    .ege-item-right {
      display: flex; flex-direction: column; align-items: flex-end;
      gap: 6px; flex-shrink: 0;
    }
    .ege-item-amount {
      font-size: 15px; font-weight: 700; color: var(--text-primary);
    }
    .ege-item-actions { display: flex; gap: 4px; }
    .ege-item-btn {
      display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      background: transparent; color: var(--text-muted);
      cursor: pointer;
      transition: background 0.12s, color 0.12s;
    }
    .ege-item-btn:hover { background: var(--accent-hover); color: var(--text-primary); }
    .ege-item-btn--del:hover { background: rgba(248,113,113,0.1); color: #f87171; border-color: #f87171; }

    .ege-pagination {
      display: flex; align-items: center; justify-content: center; gap: 12px;
    }
    .ege-page-btn {
      padding: 6px 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: transparent; color: var(--text-secondary);
      font-size: 12px; cursor: pointer;
    }
    .ege-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .ege-page-info { font-size: 12px; color: var(--text-muted); }

    /* Modal */
    .ege-modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.5); z-index: 200;
    }
    .ege-modal {
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: min(540px, 92vw);
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      z-index: 201;
      display: flex; flex-direction: column; gap: 0;
      max-height: 90vh; overflow-y: auto;
    }
    .ege-modal--sm { width: min(360px, 92vw); }
    .ege-modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px 12px;
      border-bottom: 1px solid var(--border);
    }
    .ege-modal-title { font-size: 15px; font-weight: 600; color: var(--text-primary); }
    .ege-modal-close {
      display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px;
      border-radius: var(--radius-sm); border: none;
      background: transparent; color: var(--text-muted); cursor: pointer;
    }
    .ege-modal-close:hover { background: var(--accent-hover); }
    .ege-form {
      display: flex; flex-direction: column; gap: 12px;
      padding: 16px 20px;
    }
    .ege-form-row { display: flex; gap: 12px; }
    .ege-field { display: flex; flex-direction: column; gap: 4px; flex: 1; }
    .ege-field-label { font-size: 12px; color: var(--text-secondary); }
    .ege-input {
      background: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 13px; padding: 8px 10px;
      width: 100%; box-sizing: border-box;
    }
    .ege-form-err { font-size: 12px; color: #f87171; }
    .ege-modal-actions {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 12px 20px 16px;
      border-top: 1px solid var(--border);
    }
    .ege-btn {
      padding: 8px 18px;
      border-radius: var(--radius-sm);
      font-size: 13px; font-weight: 600;
      cursor: pointer; border: none;
    }
    .ege-btn--primary { background: var(--accent); color: #fff; }
    .ege-btn--ghost {
      background: transparent; color: var(--text-secondary);
      border: 1px solid var(--border);
    }
    .ege-btn--danger { background: #f87171; color: #fff; }
    .ege-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .ege-del-msg {
      padding: 12px 20px 4px; font-size: 13px;
      color: var(--text-secondary); line-height: 1.5; margin: 0;
    }
  `]
})
export class ExpenseGuideExpensesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading  = true;
  expenses: Expense[] = [];
  total    = 0;
  page     = 1;
  limit    = 30;

  categories = CATEGORIES;
  payMethods = PAY_METHODS;

  filter = { startDate: '', endDate: '', entryType: '' as '' | 'manual' | 'automatic' };

  formOpen      = false;
  formSaving    = false;   // true only while the add/edit API call is in-flight
  isDeleting    = false;   // separate flag for the delete dialog
  formError     = '';
  editingId: string | null = null;
  form = this.blankForm();

  /** String binding for the amount input — avoids null/NaN issues with ngModel + type=number. */
  amountStr = '';

  deleteTarget: Expense | null = null;

  currencySymbol = '₹';

  constructor(private expenseService: ExpenseService) {}

  ngOnInit(): void {
    this.loadCurrency();
    this.loadExpenses();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.limit));
  }

  get totalAmount(): number {
    return this.expenses.reduce((s, e) => s + e.amount, 0);
  }

  get canSubmit(): boolean {
    const amt = parseFloat(this.amountStr);
    return !this.formSaving && !isNaN(amt) && amt > 0 && !!this.form.date;
  }

  trackById(_: number, e: Expense): string { return e._id; }

  loadExpenses(): void {
    this.loading = true;
    const p: any = { page: this.page, limit: this.limit };
    if (this.filter.startDate) p.startDate = this.filter.startDate;
    if (this.filter.endDate)   p.endDate   = this.filter.endDate;
    if (this.filter.entryType) p.entryType = this.filter.entryType;

    this.expenseService.list(p).pipe(takeUntil(this.destroy$)).subscribe(result => {
      this.expenses = result.items;
      this.total    = result.total;
      this.loading  = false;
    });
  }

  setEntryTypeFilter(type: '' | 'manual' | 'automatic'): void {
    this.filter.entryType = type;
    this.page = 1;
    this.loadExpenses();
  }

  goPage(p: number): void {
    this.page = p;
    this.loadExpenses();
  }

  openAddForm(): void {
    this.editingId  = null;
    this.form       = this.blankForm();
    this.amountStr  = '';
    this.formError  = '';
    this.formSaving = false;
    this.formOpen   = true;
  }

  openEditForm(e: Expense): void {
    this.editingId  = e._id;
    this.amountStr  = e.amount != null ? String(e.amount) : '';
    this.form = {
      amount:        e.amount,
      date:          e.date.substring(0, 10),
      merchant:      e.merchant,
      category:      e.category,
      description:   e.description,
      paymentMethod: e.paymentMethod,
      referenceId:   e.referenceId,
    };
    this.formError  = '';
    this.formSaving = false;
    this.formOpen   = true;
  }

  closeForm(): void {
    this.formOpen  = false;
    this.editingId = null;
  }

  submitForm(): void {
    const parsedAmount = parseFloat(this.amountStr);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      this.formError = 'Please enter a valid amount greater than 0.';
      return;
    }
    if (!this.form.date) {
      this.formError = 'Date is required.';
      return;
    }

    this.formSaving    = true;
    this.formError     = '';
    this.form.amount   = parsedAmount;

    const payload: CreateExpensePayload = {
      ...this.form,
      amount:    parsedAmount,
      date:      this.form.date,
      entryType: 'manual',
    };

    const req$ = this.editingId
      ? this.expenseService.update(this.editingId, payload)
      : this.expenseService.create(payload);

    req$.pipe(takeUntil(this.destroy$)).subscribe(res => {
      this.formSaving = false;
      if (!res) { this.formError = 'Failed to save. Please try again.'; return; }
      this.closeForm();
      this.loadExpenses();
    });
  }

  confirmDelete(e: Expense): void {
    this.deleteTarget = e;
  }

  doDelete(): void {
    if (!this.deleteTarget) return;
    this.isDeleting = true;
    this.expenseService.delete(this.deleteTarget._id).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.isDeleting   = false;
      this.deleteTarget = null;
      this.loadExpenses();
    });
  }

  private blankForm() {
    return {
      amount:        null as number | null,
      date:          new Date().toISOString().substring(0, 10),
      merchant:      '',
      category:      'Uncategorized',
      description:   '',
      paymentMethod: '',
      referenceId:   '',
    };
  }

  private loadCurrency(): void {
    this.expenseService.getSettings().pipe(takeUntil(this.destroy$)).subscribe(s => {
      const map: Record<string, string> = {
        INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ',
        SGD: 'S$', AUD: 'A$', CAD: 'C$', JPY: '¥',
      };
      this.currencySymbol = map[s.currency] ?? s.currency;
    });
  }
}
