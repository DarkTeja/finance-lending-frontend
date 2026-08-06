import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule, ToastController, LoadingController, MenuController } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { DbService } from '../../services/db.service';
import { SyncService } from '../../services/sync.service';

@Component({
  selector: 'app-employee-dashboard',
  templateUrl: './employee-dashboard.page.html',
  styleUrls: ['./employee-dashboard.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule, RouterModule]
})
export class EmployeeDashboardPage implements OnInit {
  currentUser: any;
  customers: any[] = [];
  loans: any[] = [];
  
  activeTab: 'customers' | 'loans' | 'collection' = 'customers';

  loanForm!: FormGroup;
  
  isAddLoanOpen = false;
  isAccountsGridOpen = false;
  highlightedLoanUuid: string | null = null;
  
  // Search and Select variables for Loan Form
  customerSearchQuery = '';
  filteredCustomersForLoan: any[] = [];
  selectedCustomerForLoan: any = null;

  // Collections variables
  collections: any[] = [];
  collectionForm!: FormGroup;
  loanSearchQuery = '';
  filteredLoansForCollection: any[] = [];
  selectedLoanForCollection: any = null;
  selectedLoanBalance: number = 0;

  // Loan Details Modal variables
  isLoanDetailsOpen = false;
  selectedDetailedLoan: any = null;
  selectedLoanTab: 'active' | 'cleared' = 'active';

  private isCalculating = false;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private authService: AuthService,
    private dbService: DbService,
    private syncService: SyncService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private menuCtrl: MenuController
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    this.initForms();
    this.setupLoanCalculationListeners();
    this.loadData();
  }

  initForms() {
    this.loanForm = this.fb.group({
      customer_uuid: ['', [Validators.required]],
      accno: ['', [Validators.required]],
      loan_amount: ['', [Validators.required, Validators.min(1)]],
      interest_rate: ['', [Validators.required, Validators.min(0)]],
      interest_amount: ['', [Validators.required, Validators.min(0)]],
      total_repayable: [{ value: '', disabled: true }, [Validators.required]]
    });

    this.collectionForm = this.fb.group({
      loan_uuid: ['', [Validators.required]],
      collected_amount: ['', [Validators.required, Validators.min(1)]],
      payment_type: ['Cash', [Validators.required]]
    });
  }

  setupLoanCalculationListeners() {
    this.loanForm.get('loan_amount')?.valueChanges.subscribe(() => this.recalculateFromRate());
    this.loanForm.get('interest_rate')?.valueChanges.subscribe(() => this.recalculateFromRate());
    this.loanForm.get('interest_amount')?.valueChanges.subscribe(() => this.recalculateFromAmount());
  }

  private recalculateFromRate() {
    if (this.isCalculating) return;
    this.isCalculating = true;

    const principal = parseFloat(this.loanForm.get('loan_amount')?.value) || 0;
    const rate = parseFloat(this.loanForm.get('interest_rate')?.value) || 0;

    if (principal > 0) {
      const interest = (principal * rate) / 100;
      const total = principal + interest;

      this.loanForm.patchValue({
        interest_amount: interest.toFixed(2),
        total_repayable: total.toFixed(2)
      }, { emitEvent: false });
    } else {
      this.loanForm.patchValue({
        interest_amount: '',
        total_repayable: ''
      }, { emitEvent: false });
    }
    this.isCalculating = false;
  }

  private recalculateFromAmount() {
    if (this.isCalculating) return;
    this.isCalculating = true;

    const principal = parseFloat(this.loanForm.get('loan_amount')?.value) || 0;
    const interest = parseFloat(this.loanForm.get('interest_amount')?.value) || 0;

    if (principal > 0) {
      const rate = (interest / principal) * 100;
      const total = principal + interest;

      this.loanForm.patchValue({
        interest_rate: rate.toFixed(2),
        total_repayable: total.toFixed(2)
      }, { emitEvent: false });
    } else {
      this.loanForm.patchValue({
        interest_rate: '',
        total_repayable: ''
      }, { emitEvent: false });
    }
    this.isCalculating = false;
  }

  loadData() {
    this.apiService.getCustomers().subscribe({
      next: async (res) => {
        this.customers = res;
        this.filteredCustomersForLoan = [...res];
        const syncedCustomers = res.map((c: any) => ({ ...c, sync_status: 'Synced' }));
        await this.dbService.setCustomers(syncedCustomers);
      },
      error: async (err) => {
        console.error('Error loading customers from server, falling back to local DB:', err);
        const cached = await this.dbService.getCustomers();
        this.customers = cached;
        this.filteredCustomersForLoan = [...cached];
      }
    });

    this.apiService.getLoans().subscribe({
      next: (res) => this.loans = res,
      error: (err) => console.error('Error loading loans:', err)
    });

    this.apiService.getCollections().subscribe({
      next: async (res) => {
        this.collections = res;
        const syncedCols = res.map((c: any) => ({ ...c, sync_status: 'Synced' }));
        await this.dbService.setCollections(syncedCols);
      },
      error: async (err) => {
        console.error('Error loading collections, falling back to local DB:', err);
        this.collections = await this.dbService.getCollections();
      }
    });
  }

  selectTab(tab: 'customers' | 'loans' | 'collection') {
    this.activeTab = tab;
    this.menuCtrl.close();
  }

  // --- Account Numbers Grid Navigation ---
  getActiveLoans() {
    return this.loans.filter(l => l.status === 'active');
  }

  scrollToLoan(loanUuid: string) {
    this.isAccountsGridOpen = false;
    this.selectedLoanTab = 'active'; // Switch to active tab so the loan is visible
    this.highlightedLoanUuid = loanUuid;

    setTimeout(() => {
      const el = document.getElementById('emp-loan-card-' + loanUuid);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150); // slight delay to allow *ngIf to render

    setTimeout(() => {
      if (this.highlightedLoanUuid === loanUuid) {
        this.highlightedLoanUuid = null;
      }
    }, 2500);
  }

  // --- Loan Details Modal ---
  openLoanDetails(loan: any) {
    this.selectedDetailedLoan = loan;
    this.isLoanDetailsOpen = true;
  }

  directoryCustomerSearchQuery = '';
  directoryLoanSearchQuery = '';

  getOtherActiveLoanNumbers(customerUuid: string, currentLoanUuid: string): string {
    const otherLoans = this.loans.filter(l => l.customer_uuid === customerUuid && l.status === 'active' && l.uuid !== currentLoanUuid);
    if (otherLoans.length === 0) return 'None';
    return otherLoans.map(l => '#' + l.accno).join(', ');
  }

  getFilteredCustomers(): any[] {
    if (!this.directoryCustomerSearchQuery) return this.customers;
    const q = this.directoryCustomerSearchQuery.toLowerCase();
    return this.customers.filter(c => 
      c.name.toLowerCase().includes(q) || c.place.toLowerCase().includes(q)
    );
  }

  getActiveLoansList(): any[] {
    const list = this.loans.filter(l => l.status === 'active');
    if (!this.directoryLoanSearchQuery) return list;
    const q = this.directoryLoanSearchQuery.toLowerCase();
    return list.filter(l => 
      l.accno.toLowerCase().includes(q) || l.customer_name.toLowerCase().includes(q)
    );
  }

  getClosedLoansList(): any[] {
    const list = this.loans.filter(l => l.status === 'closed');
    if (!this.directoryLoanSearchQuery) return list;
    const q = this.directoryLoanSearchQuery.toLowerCase();
    return list.filter(l => 
      l.accno.toLowerCase().includes(q) || l.customer_name.toLowerCase().includes(q)
    );
  }

  getTodayCollections(): any[] {
    const today = new Date().setHours(0,0,0,0);
    return this.collections.filter(c => {
      const colDate = new Date(c.collection_date).setHours(0,0,0,0);
      return colDate === today;
    });
  }

  getLoanTotalPaid(loanUuid: string): number {
    return this.collections
      .filter(c => c.loan_uuid === loanUuid)
      .reduce((sum, c) => sum + (parseFloat(c.collected_amount) || 0), 0);
  }

  getLoanBalance(loan: any): number {
    if (!loan) return 0;
    const total = parseFloat(loan.total_repayable) || 0;
    return Math.max(0, total - this.getLoanTotalPaid(loan.uuid));
  }

  getLoanHistory(loanUuid: string): any[] {
    return this.collections
      .filter(c => c.loan_uuid === loanUuid)
      .sort((a, b) => new Date(b.collection_date).getTime() - new Date(a.collection_date).getTime());
  }

  // --- Customer Search & Pick for Loan ---
  onSearchCustomer(event: any) {
    const query = (event.target.value || '').toLowerCase().trim();
    this.customerSearchQuery = query;
    if (query) {
      this.filteredCustomersForLoan = this.customers.filter(c =>
        c.name.toLowerCase().includes(query) || c.mobile_number.includes(query)
      );
    } else {
      this.filteredCustomersForLoan = [...this.customers];
    }
  }

  selectCustomer(customer: any) {
    this.selectedCustomerForLoan = customer;
    this.loanForm.patchValue({
      customer_uuid: customer.uuid
    });
  }

  openAddLoanModal() {
    this.selectedCustomerForLoan = null;
    this.customerSearchQuery = '';
    this.filteredCustomersForLoan = [...this.customers];
    this.loanForm.reset();
    this.isAddLoanOpen = true;
  }

  async onCreateLoan() {
    const rawForm = this.loanForm.getRawValue();

    if (this.loanForm.invalid) {
      this.showToast('Please verify all required fields are filled', 'warning');
      return;
    }

    const loader = await this.loadingCtrl.create({
      message: 'Processing loan disbursement...',
      spinner: 'crescent'
    });
    await loader.present();

    this.apiService.createLoan(rawForm).subscribe({
      next: async () => {
        loader.dismiss();
        this.isAddLoanOpen = false;
        this.loanForm.reset();
        this.loadData();
        this.showToast('Loan disbursed successfully', 'success');
      },
      error: async (err) => {
        loader.dismiss();
        this.showToast(err?.error?.error || 'Failed to disburse loan', 'danger');
      }
    });
  }

  // --- Collections Features ---
  onSearchLoan(event: any) {
    const query = (event.target.value || '').toLowerCase().trim();
    this.loanSearchQuery = query;
    if (query) {
      this.filteredLoansForCollection = this.getActiveLoans().filter(l => 
        l.accno.toLowerCase().includes(query) || l.customer_name.toLowerCase().includes(query)
      );
    } else {
      this.filteredLoansForCollection = this.getActiveLoans();
    }
  }

  selectLoanForCollection(loan: any) {
    this.selectedLoanForCollection = loan;
    this.collectionForm.patchValue({
      loan_uuid: loan.uuid
    });
    
    // Calculate balance
    const totalRepayable = parseFloat(loan.total_repayable) || 0;
    const pastCollections = this.collections
      .filter(c => c.loan_uuid === loan.uuid)
      .reduce((sum, c) => sum + (parseFloat(c.collected_amount) || 0), 0);
      
    this.selectedLoanBalance = Math.max(0, totalRepayable - pastCollections);
  }
  
  clearCollectionSelection() {
    this.selectedLoanForCollection = null;
    this.loanSearchQuery = '';
    this.filteredLoansForCollection = this.getActiveLoans();
    this.collectionForm.reset();
  }

  async onRecordCollection() {
    if (this.collectionForm.invalid || !this.selectedLoanForCollection) return;
    
    const amount = parseFloat(this.collectionForm.value.collected_amount);
    if (amount <= 0) {
      this.showToast('Invalid amount. Must be greater than 0.', 'warning');
      return;
    }

    const payload = {
      ...this.collectionForm.value,
      uuid: this.generateUUID(),
      organization_uuid: this.currentUser?.organization_uuid,
      collected_by_user_uuid: this.currentUser?.uuid,
      collection_date: new Date().toISOString()
    };

    const loader = await this.loadingCtrl.create({
      message: 'Recording payment...',
      spinner: 'crescent'
    });
    await loader.present();

    const actuallyOnline = await this.syncService.checkActualConnection();

    if (actuallyOnline) {
      this.apiService.createCollection(payload).subscribe({
        next: async (res) => {
          loader.dismiss();
          this.showToast('Payment recorded successfully', 'success');
          this.clearCollectionSelection();
          this.loadData();
        },
        error: async (err) => {
          loader.dismiss();
          this.showToast(err?.error?.error || 'Failed to record payment online', 'danger');
        }
      });
    } else {
      await this.saveCollectionOffline(payload);
      loader.dismiss();
    }
  }

  async saveCollectionOffline(payload: any) {
    // Save to offline db
    await this.dbService.saveCollection({
      ...payload,
      sync_status: 'Pending',
      customer_name: this.selectedLoanForCollection.customer_name,
      accno: this.selectedLoanForCollection.accno,
      collected_by_name: this.currentUser?.name
    });

    // Add to sync queue
    await this.dbService.addToSyncQueue({
      table_name: 'collections',
      record_uuid: payload.uuid,
      action: 'INSERT',
      payload: JSON.stringify(payload)
    });

    this.showToast('Payment saved offline. Will sync when online.', 'warning');
    this.clearCollectionSelection();
    
    // Refresh local lists
    this.collections = await this.dbService.getCollections();
  }

  generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async logout() {
    this.authService.logout();
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}
