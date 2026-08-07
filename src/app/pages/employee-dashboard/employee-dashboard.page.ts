import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule, ToastController, LoadingController, MenuController } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Geolocation } from '@capacitor/geolocation';
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
  
  activeTab: 'dashboard' | 'customers' | 'loans' | 'collection' | 'total-collections' = 'dashboard';
  collectionFilterDate: string = '';

  dashboardStats = { today_collection: 0, today_count: 0 };
  
  expenseForm!: FormGroup;
  isAddExpenseOpen = false;

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
  selectedEditCollection: any = null;
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

  pollInterval: any;

  ionViewWillEnter() {
    // Check immediately
    this.checkPermissions();
    // Then poll every 3 seconds for true "immediate" UI updates
    this.pollInterval = setInterval(() => {
      this.checkPermissions();
    }, 3000);
    
    this.loadData();
  }

  ionViewWillLeave() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  private checkPermissions() {
    this.apiService.getAuthMe().subscribe({
      next: (user) => {
        this.currentUser = user;
        this.authService.updateUser(user);
        
        // If disabled, log them out immediately
        if (user.status === 'disabled') {
          if (this.pollInterval) clearInterval(this.pollInterval);
          this.authService.logout();
        }
      },
      error: () => {
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.authService.logout();
      }
    });
  }

  doRefresh(event: any) {
    this.apiService.getAuthMe().subscribe({
      next: (user) => {
        this.currentUser = user;
        this.authService.updateUser(user);
        if (user.status === 'disabled') {
          this.authService.logout();
        }
      },
      error: () => this.authService.logout()
    });
    this.loadData();
    setTimeout(() => {
      event.target.complete();
    }, 1000);
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

    this.expenseForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(1)]],
      reason: ['', [Validators.required]]
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
        this.loadDashboardStats();
      },
      error: async (err) => {
        console.error('Error loading collections, falling back to local DB:', err);
        this.collections = await this.dbService.getCollections();
        this.loadDashboardStats();
      }
    });
  }

  loadDashboardStats() {
    this.apiService.getDashboardStats().subscribe({
      next: (res) => {
        // Only update if we received valid numbers, otherwise keep existing to prevent offline reset
        if (res && res.today_collection !== undefined) {
          this.dashboardStats = res;
        }
      },
      error: (err) => console.error('Error loading dashboard stats:', err)
    });
  }

  selectTab(tab: 'dashboard' | 'customers' | 'loans' | 'collection' | 'total-collections') {
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
    if (this.loanForm.invalid) {
      this.showToast('Please verify all required fields are filled', 'warning');
      return;
    }

    const rawForm: any = this.loanForm.getRawValue();

    const loader = await this.loadingCtrl.create({
      message: 'Getting location & processing loan...',
      spinner: 'crescent'
    });
    await loader.present();

    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 });
      rawForm.latitude = position.coords.latitude;
      rawForm.longitude = position.coords.longitude;
    } catch (e) {
      console.warn('Could not get location', e);
      this.showToast('Could not record GPS location. Loan will be saved without it.', 'warning');
    }

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

    const payload: any = {
      ...this.collectionForm.value,
      uuid: this.generateUUID(),
      organization_uuid: this.currentUser?.organization_uuid,
      collected_by_user_uuid: this.currentUser?.uuid,
      collection_date: new Date().toISOString()
    };

    const loader = await this.loadingCtrl.create({
      message: 'Getting location & recording payment...',
      spinner: 'crescent'
    });
    await loader.present();

    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 });
      payload.latitude = position.coords.latitude;
      payload.longitude = position.coords.longitude;
    } catch (e) {
      console.warn('Could not get location', e);
      this.showToast('Could not record GPS location. Payment will be saved without it.', 'warning');
    }

    const actuallyOnline = await this.syncService.checkActualConnection();

    if (actuallyOnline) {
      this.apiService.createCollection(payload).subscribe({
        next: async (res) => {
          loader.dismiss();
          this.showToast('Payment recorded successfully', 'success');
          this.clearCollectionSelection();
          this.loadData();
          this.loadDashboardStats();
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
    this.loadDashboardStats();
  }

  generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  getAllCollectionsSorted(): any[] {
    let filtered = [...this.collections];
    if (this.collectionFilterDate) {
      const filterDateStr = new Date(this.collectionFilterDate).toDateString();
      filtered = filtered.filter(col => new Date(col.collection_date).toDateString() === filterDateStr);
    }
    return filtered.sort((a, b) => new Date(b.collection_date).getTime() - new Date(a.collection_date).getTime());
  }

  getEmployeeCollectionSummary(): { name: string, count: number, total: number, cashTotal: number, onlineTotal: number }[] {
    const data = this.getAllCollectionsSorted();
    const summaryMap = new Map<string, { count: number, total: number, cashTotal: number, onlineTotal: number }>();

    data.forEach(col => {
      const empName = col.collected_by_name || 'Admin';
      const amt = parseFloat(col.collected_amount) || 0;
      const type = col.payment_type || 'Cash';
      
      if (!summaryMap.has(empName)) {
        summaryMap.set(empName, { count: 0, total: 0, cashTotal: 0, onlineTotal: 0 });
      }
      
      const stat = summaryMap.get(empName)!;
      stat.count += 1;
      stat.total += amt;
      if (type === 'Cash') stat.cashTotal += amt;
      if (type === 'Online') stat.onlineTotal += amt;
    });

    const result = Array.from(summaryMap.entries()).map(([name, stats]) => {
      return { name, count: stats.count, total: stats.total, cashTotal: stats.cashTotal, onlineTotal: stats.onlineTotal };
    });

    return result.sort((a, b) => b.total - a.total);
  }

  exportToExcel() {
    const data = this.getAllCollectionsSorted();
    if (data.length === 0) return;

    let csvContent = 'Account No,Name,Amount,Type,Receipt,Place,Date and Time\n';
    
    data.forEach(col => {
      const d = new Date(col.collection_date);
      const dateStr = d.toLocaleDateString();
      const timeStr = d.toLocaleTimeString();
      const amt = col.collected_amount;
      const place = col.customer_place || 'N/A';
      const dateTimeStr = `${dateStr} ${timeStr}`;
      
      const row = `"${col.accno}","${col.customer_name}","${amt}","${col.payment_type || 'Cash'}","${col.receipt_no}","${place}","${dateTimeStr}"`;
      csvContent += row + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const datePostfix = this.collectionFilterDate ? this.collectionFilterDate : 'All';
    link.setAttribute('download', `Collections_${datePostfix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportToPdf() {
    const data = this.getAllCollectionsSorted();
    if (data.length === 0) return;

    const doc = new jsPDF();
    const datePostfix = this.collectionFilterDate ? this.collectionFilterDate : 'All';
    
    doc.text(`Collections - ${datePostfix}`, 14, 15);
    
    const tableData = data.map(col => {
      const d = new Date(col.collection_date);
      const place = col.customer_place || 'N/A';
      return [
        col.accno,
        col.customer_name,
        col.collected_amount,
        col.payment_type || 'Cash',
        col.receipt_no,
        place,
        `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`
      ];
    });

    autoTable(doc, {
      head: [['Account No', 'Name', 'Amount', 'Type', 'Receipt', 'Place', 'Date & Time']],
      body: tableData,
      startY: 20,
    });

    doc.save(`Collections_${datePostfix}.pdf`);
  }

  openAddExpenseModal() {
    this.expenseForm.reset();
    this.isAddExpenseOpen = true;
  }

  async onRecordExpense() {
    if (this.expenseForm.invalid) return;
    
    const loader = await this.loadingCtrl.create({
      message: 'Recording expense...',
      spinner: 'crescent'
    });
    await loader.present();

    this.apiService.addExpense(this.expenseForm.value).subscribe({
      next: async () => {
        loader.dismiss();
        this.isAddExpenseOpen = false;
        this.showToast('Expense recorded successfully', 'success');
        this.loadDashboardStats();
      },
      error: async (err) => {
        loader.dismiss();
        this.showToast(err?.error?.error || 'Failed to record expense', 'danger');
      }
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
