import { Subscription } from 'rxjs';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule, ToastController, LoadingController, MenuController, ActionSheetController } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Geolocation } from '@capacitor/geolocation';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { DbService } from '../../services/db.service';
import { SyncService } from '../../services/sync.service';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-employee-dashboard',
  templateUrl: './employee-dashboard.page.html',
  styleUrls: ['./employee-dashboard.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule, RouterModule, DragDropModule]
})
export class EmployeeDashboardPage implements OnInit {
  private userSubscription!: Subscription;
  currentUser: any;
  loginHistory: any[] = [];
  customers: any[] = [];
  loans: any[] = [];

  // Lazy loading limits
  customersDisplayLimit = 20;
  loansDisplayLimit = 20;
  todayCollectionsDisplayLimit = 20;

  totalCollectionsDisplayLimit = 20;

  loadMore(event: any, listType: 'customers' | 'loans' | 'todayCollections' | 'totalCollections') {
    if (listType === 'customers') {
      this.customersDisplayLimit += 20;
    } else if (listType === 'loans') {
      this.loansDisplayLimit += 20;
    } else if (listType === 'todayCollections') {
      this.todayCollectionsDisplayLimit += 20;
    } else if (listType === 'totalCollections') {
      this.totalCollectionsDisplayLimit += 20;
    }
    
    if (event && event.target) {
      event.target.complete();
    }
  }

  isOnline = true;
  
  activeTab: 'dashboard' | 'customers' | 'loans' | 'collection' | 'total-collections' | 'defaulters' = 'dashboard';
  collectionFilterDate: string = new Date().toISOString().split('T')[0];

  onCollectionDateChange(event: any) {
    if (event.detail && event.detail.value) {
      // ion-datetime sometimes returns an array if multiple dates are selected, but we use presentation="date"
      const val = Array.isArray(event.detail.value) ? event.detail.value[0] : event.detail.value;
      this.collectionFilterDate = typeof val === 'string' ? val.split('T')[0] : val;
      this.updateCachedCalculations();
    }
  }

  clearCollectionFilterDate(event: Event) {
    event.stopPropagation();
    this.collectionFilterDate = '';
    this.updateCachedCalculations();
  }

  defaultersDaysThreshold = 5;
  getDefaulters() {
    const now = new Date();
    return this.loans.filter(loan => {
      if (loan.status !== 'active') return false;
      
      const loanCollections = this.collections.filter(c => c.loan_uuid === loan.uuid);
      let lastDate: Date;
      
      if (loanCollections.length > 0) {
        loanCollections.sort((a, b) => new Date(b.collection_date).getTime() - new Date(a.collection_date).getTime());
        lastDate = new Date(loanCollections[0].collection_date);
        loan.last_paid_date = loanCollections[0].collection_date; 
      } else {
        lastDate = new Date(loan.created_at);
        loan.last_paid_date = null;
      }
      
      const diffTime = Math.abs(now.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays > this.defaultersDaysThreshold;
    });
  }

  dashboardStats: any = { today_collection: 0, today_count: 0, today_expenses: 0 };
  employeeSummaryCount = 0;
  employeeSummaryTotal = 0;
  employeeSummaryCashTotal = 0;
  employeeSummaryOnlineTotal = 0;
  isSwitchingTab: boolean = false;

  // Cached calculated arrays to prevent UI freezing
  cachedAllCollectionsSorted: any[] = [];
  
  updateCachedCalculations() {
    this.cachedAllCollectionsSorted = this.getAllCollectionsSorted();
  }
  metricsConfig: any[] = [
    { id: 'today', title: 'Today Collection', color: '#3b82f6', key: 'today_collection', size: 'half' },
    { id: 'count', title: 'Collections Count', color: '#ec4899', key: 'today_count', size: 'half' },
    { id: 'exp', title: 'Today Expenses', color: '#e74c3c', key: 'today_expenses', size: 'half' }
  ];
  
  isEditingLayout = false;
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
    public dbService: DbService,
    public syncService: SyncService,
    private authService: AuthService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private menuCtrl: MenuController,
    private actionSheetCtrl: ActionSheetController
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    this.initForms();
    this.setupLoanCalculationListeners();
    this.loadData();
    this.loadLoginHistory();

    const savedLayout = localStorage.getItem('employeeDashboardMetricsLayout');
    if (savedLayout) {
      try {
        const order = JSON.parse(savedLayout);
        this.metricsConfig.sort((a, b) => {
          const idxA = order.indexOf(a.id);
          const idxB = order.indexOf(b.id);
          return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999);
        });
      } catch (e) {
        console.error('Error loading dashboard layout', e);
      }
    }

    const savedSizesStr = localStorage.getItem('employeeDashboardMetricsSizes');
    if (savedSizesStr) {
      try {
        const savedSizes = JSON.parse(savedSizesStr);
        this.metricsConfig.forEach(metric => {
          if (savedSizes[metric.id]) {
            metric.size = savedSizes[metric.id];
          }
        });
      } catch (e) {
        console.error('Error loading dashboard sizes', e);
      }
    }
  }

  pollInterval: any;

  ionViewWillEnter() {
    this.currentUser = this.authService.getCurrentUser();
    this.loadLoginHistory();
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

  loadLoginHistory() {
    this.apiService.getLoginHistory().subscribe({
      next: (res: any) => {
        this.loginHistory = res;
      },
      error: (err) => {
        console.error('Failed to load login history', err);
      }
    });
  }

  loadData() {
    this.apiService.getCustomers().subscribe({
      next: async (res) => {
        const sorted = res.sort((a: any, b: any) => {
          const tA = a.created_at ? new Date(a.created_at).getTime() : Date.now();
          const tB = b.created_at ? new Date(b.created_at).getTime() : Date.now();
          return tB - tA;
        });
        this.customers = sorted;
        this.filteredCustomersForLoan = [...sorted];
        const syncedCustomers = res.map((c: any) => ({ ...c, sync_status: 'Synced' }));
        await this.dbService.setCustomers(syncedCustomers);
      },
      error: async (err) => {
        console.error('Error loading customers from server, falling back to local DB:', err);
        const cached = await this.dbService.getCustomers();
        const sorted = cached.sort((a: any, b: any) => {
          const tA = a.created_at ? new Date(a.created_at).getTime() : Date.now();
          const tB = b.created_at ? new Date(b.created_at).getTime() : Date.now();
          return tB - tA;
        });
        this.customers = sorted;
        this.filteredCustomersForLoan = [...sorted];
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
        this.updateCachedCalculations();
      },
      error: async (err) => {
        console.error('Error loading collections, falling back to local DB:', err);
        this.collections = await this.dbService.getCollections();
        this.loadDashboardStats();
        this.updateCachedCalculations();
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
      error: (err) => {
        console.error('Error loading dashboard stats:', err);
      }
    });
  }

  selectTab(tab: 'dashboard' | 'customers' | 'loans' | 'collection' | 'total-collections' | 'defaulters') {
    if (this.isSwitchingTab) return;
    this.isSwitchingTab = true;

    this.menuCtrl.close('emp-menu').then(() => {
      this.activeTab = tab;
      this.updateCachedCalculations(); // Update caches when switching tabs
      this.isSwitchingTab = false;
    }).catch(() => {
      this.activeTab = tab;
      this.updateCachedCalculations();
      this.isSwitchingTab = false;
    });
  }

  closeMenu() {
    this.menuCtrl.close('emp-menu');
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
    
    list.sort((a, b) => {
      const balA = this.getLoanBalance(a) <= 0 ? 0 : 1;
      const balB = this.getLoanBalance(b) <= 0 ? 0 : 1;
      if (balA !== balB) return balA - balB; // 0 balance comes first
      
      const tA = a.created_at ? new Date(a.created_at.toString().replace(' ', 'T')).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at.toString().replace(' ', 'T')).getTime() : 0;
      return tB - tA; // Then newest first
    });

    if (!this.directoryLoanSearchQuery) return list;
    const q = this.directoryLoanSearchQuery.toLowerCase();
    return list.filter(l => 
      l.accno.toLowerCase().includes(q) || l.customer_name.toLowerCase().includes(q)
    );
  }

  getClosedLoansList(): any[] {
    const list = this.loans.filter(l => l.status === 'closed');
    list.sort((a, b) => {
      const tA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const tB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return tB - tA;
    });
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
    const loan = this.loans.find(l => l.uuid === loanUuid);
    if (loan && loan.total_paid !== undefined) {
      return parseFloat(loan.total_paid);
    }
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
      const position: any = await Promise.race([
        Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Location timeout')), 15500))
      ]);
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
      const position: any = await Promise.race([
        Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Location timeout')), 15500))
      ]);
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
          this.updateCachedCalculations();
        },
        error: async (err) => {
          loader.dismiss();
          console.error('Online sync failed, saving locally', err);
          payload.sync_status = 'Pending';
          await this.dbService.saveCollection(payload);
          this.showToast('Saved offline. Will sync when online.', 'warning');
          this.clearCollectionSelection();
          this.loadData();
          this.loadDashboardStats();
          this.updateCachedCalculations();
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

  getTotalFilteredCollectionAmount(): number {
    return this.getAllCollectionsSorted().reduce((sum, col) => sum + (parseFloat(col.collected_amount) || 0), 0);
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
      const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
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
    let formattedDatePostfix = 'All';
    if (this.collectionFilterDate) {
      const parts = this.collectionFilterDate.split('-');
      if (parts.length === 3) {
        formattedDatePostfix = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else {
        formattedDatePostfix = this.collectionFilterDate;
      }
    }
    
    doc.text(`Collections - ${formattedDatePostfix}`, 14, 15);
    
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
        `${`${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`} ${d.toLocaleTimeString()}`
      ];
    });

    autoTable(doc, {
      head: [['Account No', 'Name', 'Amount', 'Type', 'Receipt', 'Place', 'Date & Time']],
      body: tableData,
      startY: 20,
    });

    doc.save(`Collections_${formattedDatePostfix.replace(/\//g, '-')}.pdf`);
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

  toggleEditLayout() {
    this.isEditingLayout = !this.isEditingLayout;
  }

  toggleMetricSize(metricId: string) {
    const metric = this.metricsConfig.find(m => m.id === metricId);
    if (metric) {
      metric.size = metric.size === 'full' ? 'half' : 'full';
      const sizes: any = {};
      this.metricsConfig.forEach(m => { sizes[m.id] = m.size; });
      localStorage.setItem('employeeDashboardMetricsSizes', JSON.stringify(sizes));
    }
  }

  dropMetric(event: CdkDragDrop<any[]>) {
    moveItemInArray(this.metricsConfig, event.previousIndex, event.currentIndex);
    const order = this.metricsConfig.map(m => m.id);
    localStorage.setItem('employeeDashboardMetricsLayout', JSON.stringify(order));
  }

  trackByMetricId(index: number, metric: any): string {
    return metric.id;
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

  async openProfileMenu() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: this.currentUser?.name || 'Profile',
      subHeader: this.currentUser?.organization_name || 'Workspace',
      cssClass: 'custom-action-sheet',
      buttons: [
        {
          text: 'Sign Out',
          icon: 'log-out-outline',
          role: 'destructive',
          handler: () => {
            this.logout();
          }
        },
        {
          text: 'Cancel',
          icon: 'close-outline',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }
}
