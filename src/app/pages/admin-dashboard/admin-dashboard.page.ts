import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule, ToastController, LoadingController, AlertController, MenuController, ActionSheetController } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { Geolocation } from '@capacitor/geolocation';
import { ApiService } from '../../services/api.service';
import { DbService } from '../../services/db.service';
import { SyncService } from '../../services/sync.service';
import { AuthService } from '../../services/auth.service';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Chart, registerables } from 'chart.js';
import * as XLSX from 'xlsx';

Chart.register(...registerables);
@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.page.html',
  styleUrls: ['./admin-dashboard.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule, RouterModule, DragDropModule]
})
export class AdminDashboardPage implements OnInit {
  currentUser: any;
  loginHistory: any[] = [];
  employees: any[] = [];
  customers: any[] = [];
  loans: any[] = [];

  activeTab: 'dashboard' | 'users' | 'customers' | 'loans' | 'collection' | 'total-collections' | 'reports' | 'investments' | 'expenses' | 'withdrawals' | 'cashbook' | 'defaulters' = 'dashboard';

  isProfileMenuOpen = false;
  investments: any[] = [];
  allExpenses: any[] = [];
  investmentForm!: FormGroup;
  editInvestmentForm!: FormGroup;
  isEditInvestmentOpen = false;
  selectedInvestmentForEdit: any = null;

  dashboardStats: any = {
    today_collection: 0,
    bf_cash: 0,
    receivable_amount: 0,
    extra_amount: 0,
    interests: 0,
    total_investments: 0,
    total_expenses: 0,
    customer_count: 0,
    employee_count: 0,
    all_time_turnover: 0,
    total_loans_given: 0,
    total_collections_all_time: 0
  };

  isEditingLayout = false;
  metricsConfig = [
    { id: 'today', title: 'Today\'s Collection', color: '#10b981', key: 'today_collection', size: 'half', hidden: false },
    { id: 'bfc', title: 'Cash In Hand', color: '#f59e0b', key: 'bf_cash', size: 'half', hidden: false },
    { id: 'rec', title: 'Pending Amount', color: '#ef4444', key: 'receivable_amount', size: 'half', hidden: false },
    { id: 'pen', title: 'Penalties', color: '#8b5cf6', key: 'extra_amount', size: 'half', hidden: false },
    { id: 'int', title: 'Interest Earned', color: '#3b82f6', key: 'interests', size: 'half', hidden: false },
    { id: 'inv', title: 'Total Invested', color: '#ec4899', key: 'total_investments', size: 'half', hidden: false },
    { id: 'exp', title: 'Total Expenses', color: '#e74c3c', key: 'total_expenses', size: 'half', hidden: false },
    { id: 'dis', title: 'Total Disbursed', color: '#14b8a6', key: 'total_loans_given', size: 'half', hidden: false },
    { id: 'col', title: 'Total Collected', color: '#8b5cf6', key: 'total_collections_all_time', size: 'half', hidden: false },
    { id: 'turn', title: 'Turnover (Disbursed + Collected)', color: '#06b6d4', key: 'all_time_turnover', size: 'half', hidden: false }
  ];

  expenseForm!: FormGroup;
  editExpenseForm!: FormGroup;
  isAddExpenseOpen = false;
  isAddInvestmentOpen = false;
  isEditExpenseOpen = false;
  selectedExpenseForEdit: any = null;
  isChangeMyPasswordOpen = false;

  // Withdrawals
  withdrawals: any[] = [];
  isWithdrawalModalOpen = false;
  withdrawalForm: FormGroup;
  dashboardFilterRange: string = 'all';


  getLocalISODate(): string {
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    return new Date(Date.now() - tzOffset).toISOString().split('T')[0];
  }

  defaultersDaysThreshold = 5;
  getDefaulters() {
    const now = new Date();
    return this.loans.filter(loan => {
      if (loan.status !== 'active') return false;

      const loanCollections = this.collections.filter(c => c.loan_uuid === loan.uuid);
      let lastDate: Date;

      if (loanCollections.length > 0) {
        // Find most recent collection
        loanCollections.sort((a, b) => new Date(b.collection_date).getTime() - new Date(a.collection_date).getTime());
        lastDate = new Date(loanCollections[0].collection_date);
        loan.last_paid_date = loanCollections[0].collection_date; // for display
      } else {
        lastDate = new Date(loan.created_at);
        loan.last_paid_date = null;
      }

      const diffTime = Math.abs(now.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // If it's more than threshold days ago, they are a defaulter
      return diffDays > this.defaultersDaysThreshold;
    });
  }

  expenseFilterDate: string = this.getLocalISODate();

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

    // Complete the infinite scroll event
    if (event && event.target) {
      event.target.complete();
    }
  }

  // Cashbook / Ledger variables
  cashbookDate: string = this.getLocalISODate();
  todayIsoDate: string = this.getLocalISODate();
  cashbookData: any = null;
  cashbookClosingBalance: number = 0;

  employeeForm!: FormGroup;
  editEmployeeForm!: FormGroup;
  isEditEmployeeOpen = false;
  selectedEditEmployee: any = null;
  permissionForm!: FormGroup;
  loanForm!: FormGroup;
  editCustomerForm!: FormGroup;
  editLoanForm!: FormGroup;
  // Modals state
  isAddEmployeeOpen = false;
  isManagePermissionsOpen = false;
  isAddCustomerOpen = false;
  isEditCustomerOpen = false;
  isAddLoanOpen = false;
  isEditLoanOpen = false;
  isAccountsGridOpen = false;
  isResetEmployeePasswordOpen = false;

  changeMyPasswordForm!: FormGroup;
  resetEmployeePasswordForm!: FormGroup;
  selectedEmployeeForReset: any = null;
  highlightedLoanUuid: string | null = null;

  // Bulk Import State
  isBulkImportModalOpen = false;
  bulkImportFile: File | null = null;
  isUploadingBulk = false;
  importResults: any = null;
  parsedLoansPreview: any[] = [];
  parsedTransactionsPreview: any[] = [];
  previewTotalTransactions: number = 0;

  selectedEmployeeForPermissions: any = null;
  selectedCustomerForManage: any = null;
  selectedLoanForManage: any = null;

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

  // Collection Edit Modal variables
  isEditCollectionOpen = false;
  selectedEditCollection: any = null;
  editCollectionForm!: FormGroup;

  // Track locks to prevent circular updates in bidirectional calculators
  private isCalculating = false;
  private isEditCalculating = false;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    public dbService: DbService,
    public syncService: SyncService,
    private authService: AuthService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private menuCtrl: MenuController,
    private actionSheetCtrl: ActionSheetController
  ) {
    this.withdrawalForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(1)]],
      reason: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    this.initForms();
    this.setupLoanCalculationListeners();
    this.loadData();
    this.loadLoginHistory();

    const savedLayout = localStorage.getItem('adminDashboardMetricsLayout');
    if (savedLayout) {
      try {
        const order = JSON.parse(savedLayout);
        this.metricsConfig.sort((a, b) => {
          const idxA = order.indexOf(a.id);
          const idxB = order.indexOf(999);
          return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999);
        });
      } catch (e) {
        console.error('Error loading dashboard layout', e);
      }
    }

    const savedSizesStr = localStorage.getItem('adminDashboardMetricsSizes');
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

    const savedHiddenStr = localStorage.getItem('adminDashboardMetricsHidden');
    if (savedHiddenStr) {
      try {
        const savedHidden = JSON.parse(savedHiddenStr);
        this.metricsConfig.forEach(metric => {
          if (savedHidden[metric.id]) {
            metric.hidden = true;
          }
        });
      } catch (e) {
        console.error('Error loading dashboard hidden state', e);
      }
    }
  }

  ionViewWillEnter() {
    this.currentUser = this.authService.getCurrentUser();
    this.loadLoginHistory();
    this.loadData();
    this.loadWithdrawals();
  }

  loadWithdrawals() {
    this.apiService.getWithdrawals().subscribe({
      next: (res) => this.withdrawals = res,
      error: (err) => console.error('Error loading withdrawals:', err)
    });
  }

  doRefresh(event: any) {
    this.loadData();
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }

  toggleEditLayout() {
    this.isEditingLayout = !this.isEditingLayout;
  }

  toggleMetricSize(metricId: string) {
    const metric = this.metricsConfig.find(m => m.id === metricId);
    if (metric) {
      metric.size = metric.size === 'full' ? 'half' : 'full';

      const sizes: any = {};
      this.metricsConfig.forEach(m => {
        sizes[m.id] = m.size;
      });
      localStorage.setItem('adminDashboardMetricsSizes', JSON.stringify(sizes));
    }
  }

  toggleMetricVisibility(metricId: string) {
    const metric = this.metricsConfig.find(m => m.id === metricId);
    if (metric) {
      metric.hidden = !metric.hidden;

      const hiddenState: any = {};
      this.metricsConfig.forEach(m => {
        if (m.hidden) hiddenState[m.id] = true;
      });
      localStorage.setItem('adminDashboardMetricsHidden', JSON.stringify(hiddenState));
    }
  }

  dropMetric(event: CdkDragDrop<any[]>) {
    moveItemInArray(this.metricsConfig, event.previousIndex, event.currentIndex);
    const order = this.metricsConfig.map(m => m.id);
    localStorage.setItem('adminDashboardMetricsLayout', JSON.stringify(order));
  }

  trackByMetricId(index: number, metric: any): string {
    return metric.id;
  }

  initForms() {
    this.employeeForm = this.fb.group({
      name: ['', Validators.required],
      username: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      mobile_number: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      can_disburse_loans: [true],
      can_collect_payments: [true],
      can_view_reports: [false],
      can_view_total_collections: [false],
      can_view_defaulters: [false],
        can_view_maps: [true]
      });
    this.editEmployeeForm = this.fb.group({
      name: ['', Validators.required],
      mobile_number: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]]
    });

    this.permissionForm = this.fb.group({
      can_disburse_loans: [true],
      can_collect_payments: [true],
      can_view_reports: [false],
      can_view_total_collections: [false],
      can_view_defaulters: [false],
        can_view_maps: [true]
      });

    this.loanForm = this.fb.group({
      customer_uuid: ['', [Validators.required]],
      accno: ['', [Validators.required]],
      loan_amount: ['', [Validators.required, Validators.min(1)]],
      interest_rate: ['', [Validators.required, Validators.min(0)]],
      interest_amount: ['', [Validators.required, Validators.min(0)]],
      total_repayable: [{ value: '', disabled: true }, [Validators.required]]
    });

    this.editCustomerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      mobile_number: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      place: ['', [Validators.required, Validators.minLength(3)]],
      father_name: [''],
      aadhaar_number: [''],
      pan_number: [''],
      address: [''],
      occupation: [''],
      guarantor_name: [''],
      guarantor_mobile: [''],
      collection_days: ['Daily'],
      notes: ['']
    });

    this.editLoanForm = this.fb.group({
      accno: ['', [Validators.required]],
      loan_amount: ['', [Validators.required, Validators.min(1)]],
      interest_rate: ['', [Validators.required, Validators.min(0)]],
      interest_amount: ['', [Validators.required, Validators.min(0)]],
      total_repayable: [{ value: '', disabled: true }, [Validators.required]],
      status: ['active', [Validators.required]]
    });

    this.collectionForm = this.fb.group({
      loan_uuid: ['', [Validators.required]],
      collected_amount: ['', [Validators.required, Validators.min(1)]],
      payment_type: ['Cash', [Validators.required]]
    });

    this.editCollectionForm = this.fb.group({
      collected_amount: ['', [Validators.required, Validators.min(1)]],
      collection_date: ['', Validators.required],
      payment_type: ['Cash', [Validators.required]]
    });

    this.expenseForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(1)]],
      reason: ['', Validators.required]
    });

    this.editExpenseForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(1)]],
      reason: ['', Validators.required]
    });

    this.investmentForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(1)]],
      source: ['', Validators.required]
    });

    this.editInvestmentForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(1)]],
      source: ['', Validators.required]
    });

    this.withdrawalForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(1)]],
      reason: ['', Validators.required]
    });

    this.changeMyPasswordForm = this.fb.group({
      current_password: ['', [Validators.required]],
      new_password: ['', [Validators.required, Validators.minLength(6)]],
      confirm_password: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator('new_password', 'confirm_password') });

    this.resetEmployeePasswordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator('newPassword', 'confirmPassword') });
  }

  passwordMatchValidator(passwordKey: string, confirmPasswordKey: string) {
    return (g: FormGroup) => {
      const password = g.get(passwordKey)?.value;
      const confirmPassword = g.get(confirmPasswordKey)?.value;
      return password === confirmPassword ? null : { mismatch: true };
    };
  }

  setupLoanCalculationListeners() {
    this.loanForm.get('loan_amount')?.valueChanges.subscribe(() => this.recalculateFromRate());
    this.loanForm.get('interest_rate')?.valueChanges.subscribe(() => this.recalculateFromRate());
    this.loanForm.get('interest_amount')?.valueChanges.subscribe(() => this.recalculateFromAmount());

    this.editLoanForm.get('loan_amount')?.valueChanges.subscribe(() => this.recalculateEditFromRate());
    this.editLoanForm.get('interest_rate')?.valueChanges.subscribe(() => this.recalculateEditFromRate());
    this.editLoanForm.get('interest_amount')?.valueChanges.subscribe(() => this.recalculateEditFromAmount());
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

  private recalculateEditFromRate() {
    if (this.isEditCalculating) return;
    this.isEditCalculating = true;

    const principal = parseFloat(this.editLoanForm.get('loan_amount')?.value) || 0;
    const rate = parseFloat(this.editLoanForm.get('interest_rate')?.value) || 0;

    if (principal > 0) {
      const interest = (principal * rate) / 100;
      const total = principal + interest;

      this.editLoanForm.patchValue({
        interest_amount: interest.toFixed(2),
        total_repayable: total.toFixed(2)
      }, { emitEvent: false });
    } else {
      this.editLoanForm.patchValue({
        interest_amount: '',
        total_repayable: ''
      }, { emitEvent: false });
    }

    this.isEditCalculating = false;
  }

  private recalculateEditFromAmount() {
    if (this.isEditCalculating) return;
    this.isEditCalculating = true;

    const principal = parseFloat(this.editLoanForm.get('loan_amount')?.value) || 0;
    const interest = parseFloat(this.editLoanForm.get('interest_amount')?.value) || 0;

    if (principal > 0) {
      const rate = (interest / principal) * 100;
      const total = principal + interest;

      this.editLoanForm.patchValue({
        interest_rate: rate.toFixed(2),
        total_repayable: total.toFixed(2)
      }, { emitEvent: false });
    } else {
      this.editLoanForm.patchValue({
        interest_rate: '',
        total_repayable: ''
      }, { emitEvent: false });
    }

    this.isEditCalculating = false;
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
    this.apiService.getEmployees().subscribe({
      next: (res) => this.employees = res,
      error: (err) => console.error('Error loading employees:', err)
    });

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
      },
      error: async (err) => {
        console.error('Error loading collections, falling back to local DB:', err);
        this.collections = await this.dbService.getCollections();
      }
    });

    this.apiService.getInvestments().subscribe({
      next: (res) => this.investments = res,
      error: (err) => console.error('Error loading investments:', err)
    });

    this.apiService.getAllExpenses().subscribe({
      next: (res) => this.allExpenses = res,
      error: (err) => console.error('Error loading expenses:', err)
    });

    this.loadDashboardStats();
    this.loadCashbook();
    
    // Update caches after loading data
    setTimeout(() => {
      this.updateCachedCalculations();
    }, 500);
  }

  loadCashbook() {
    this.apiService.getCashbook(this.cashbookDate).subscribe({
      next: (res) => {
        this.cashbookData = res;
        this.calculateCashbookClosingBalance();
      },
      error: (err) => {
        console.error('Error loading cashbook:', err);
        this.cashbookData = null;
      }
    });
  }

  onCashbookDateChange(event: any) {
    if (event.detail && event.detail.value) {
      this.cashbookDate = event.detail.value.split('T')[0];
      this.loadCashbook();
    }
  }

  calculateCashbookClosingBalance() {
    if (!this.cashbookData) return;
    let balance = parseFloat(this.cashbookData.opening_balance) || 0;

    if (this.cashbookData.transactions && this.cashbookData.transactions.length > 0) {
      for (const tx of this.cashbookData.transactions) {
        const amount = parseFloat(tx.amount) || 0;
        if (tx.type === 'collection' || tx.type === 'investment') {
          balance += amount;
        } else if (tx.type === 'loan' || tx.type === 'expense' || tx.type === 'withdrawal') {
          balance -= amount;
        }
      }
    }
    this.cashbookClosingBalance = balance;
  }

  exportCashbookToPDF() {
    if (!this.cashbookData) return;

    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(`Cash Book / Ledger`, 14, 15);

    const cbDateObj = new Date(this.cashbookDate);
    const formattedCbDate = `${cbDateObj.getDate().toString().padStart(2, '0')}/${(cbDateObj.getMonth() + 1).toString().padStart(2, '0')}/${cbDateObj.getFullYear()}`;

    doc.setFontSize(11);
    doc.text(`Date: ${formattedCbDate}`, 14, 23);
    doc.text(`Opening Balance: Rs. ${this.cashbookData.opening_balance}`, 14, 29);

    const tableData = [];

    if (this.cashbookData.transactions && this.cashbookData.transactions.length > 0) {
      for (const tx of this.cashbookData.transactions) {
        const type = tx.type.charAt(0).toUpperCase() + tx.type.slice(1);
        const inflowOutflow = (tx.type === 'collection' || tx.type === 'investment') ? 'Inflow' : 'Outflow';
        const amountStr = `${inflowOutflow === 'Inflow' ? '+' : '-'} Rs. ${tx.amount}`;

        tableData.push([
          new Date(tx.tx_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type,
          tx.description,
          amountStr
        ]);
      }
    }

    autoTable(doc, {
      startY: 35,
      head: [['Time', 'Type', 'Description', 'Amount']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [41, 128, 185] },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 35;
    doc.setFontSize(12);
    doc.text(`Closing Balance: Rs. ${this.cashbookClosingBalance}`, 14, finalY + 10);

    const filename = `CashBook_${this.cashbookDate}.pdf`;
    const base64Str = btoa(doc.output());
    this.downloadFileToDevice(base64Str, filename, 'application/pdf');
  }

  loadDashboardStats() {
    this.apiService.getDashboardStats(this.dashboardFilterRange).subscribe({
      next: (res) => {
        this.dashboardStats = res;

        // Dynamic mappings for filtering
        if (res.filtered_loans_given !== undefined) {
          this.dashboardStats['total_loans_given'] = res.filtered_loans_given;
        }
        if (res.filtered_collections !== undefined) {
          this.dashboardStats['total_collections_all_time'] = res.filtered_collections;
        }
        if (res.filtered_expenses !== undefined) {
          this.dashboardStats['total_expenses'] = res.filtered_expenses;
        }
        if (res.filtered_investments !== undefined) {
          this.dashboardStats['total_investments'] = res.filtered_investments;
        }
        if (res.filtered_extra !== undefined) {
          this.dashboardStats['extra_amount'] = res.filtered_extra;
        }
        if (res.filtered_interests !== undefined) {
          this.dashboardStats['interests'] = res.filtered_interests;
        }
      },
      error: (err) => console.error('Error loading dashboard stats:', err)
    });
  }

  isSwitchingTab: boolean = false;

  selectTab(tab: 'dashboard' | 'users' | 'customers' | 'loans' | 'collection' | 'total-collections' | 'reports' | 'investments' | 'expenses' | 'withdrawals' | 'cashbook' | 'defaulters') {
    if (this.isSwitchingTab) return;
    this.isSwitchingTab = true;

    // Close the menu first to ensure smooth 60fps animation
    this.menuCtrl.close('main-menu').then(() => {
      // Change the heavy DOM tab only AFTER the menu is completely closed
      this.activeTab = tab;
      this.updateCachedCalculations(); // Update caches when switching tabs
      
      if (tab === 'reports') {
        setTimeout(() => {
          this.generateCharts();
        }, 100);
      } else if (tab === 'cashbook') {
        this.loadCashbook();
      }

      this.isSwitchingTab = false;
    }).catch(() => {
      // Failsafe if animation aborts
      this.activeTab = tab;
      this.updateCachedCalculations();
      this.isSwitchingTab = false;
    });
  }

  closeMenu() {
    this.menuCtrl.close('main-menu');
  }

  async recordWithdrawal() {
    if (this.withdrawalForm.invalid) return;

    const loader = await this.loadingCtrl.create({
      message: 'Recording withdrawal...',
      spinner: 'crescent'
    });
    await loader.present();

    this.apiService.addWithdrawal(this.withdrawalForm.value).subscribe({
      next: async () => {
        loader.dismiss();
        this.showToast('Withdrawal recorded successfully', 'success');
        this.isWithdrawalModalOpen = false;
        this.withdrawalForm.reset();
        this.loadDashboardStats();
        this.loadWithdrawals();
        if (this.cashbookDate) this.loadCashbook();
      },
      error: async (err) => {
        loader.dismiss();
        this.showToast(err?.error?.error || 'Failed to record withdrawal', 'danger');
      }
    });
  }

  async onDeleteWithdrawal(uuid: string) {
    const alert = await this.alertCtrl.create({
      header: 'Confirm Delete',
      message: 'Are you sure you want to delete this withdrawal?',
      cssClass: 'custom-glass-alert',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            const loader = await this.loadingCtrl.create({ message: 'Deleting...' });
            await loader.present();
            this.apiService.deleteWithdrawal(uuid).subscribe({
              next: async () => {
                loader.dismiss();
                this.showToast('Withdrawal deleted', 'success');
                this.loadWithdrawals();
                this.loadDashboardStats();
                if (this.cashbookDate) this.loadCashbook();
              },
              error: async (err) => {
                loader.dismiss();
                this.showToast(err?.error?.error || 'Failed to delete withdrawal', 'danger');
              }
            });
          }
        }
      ]
    });
    await alert.present();
  }

  private charts: any = {};

  generateCharts() {
    if (this.charts['collectionsTrend']) this.charts['collectionsTrend'].destroy();
    if (this.charts['loanStatus']) this.charts['loanStatus'].destroy();
    if (this.charts['incomeExpense']) this.charts['incomeExpense'].destroy();

    // 1. Collections Trend (Last 30 Days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyCollections: any = {};
    this.collections.forEach(col => {
      const d = new Date(col.collection_date);
      if (d >= thirtyDaysAgo) {
        // Use local time instead of UTC to avoid shifting dates backward in IST
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        if (!dailyCollections[dateStr]) dailyCollections[dateStr] = 0;
        dailyCollections[dateStr] += Number(col.collected_amount || 0);
      }
    });

    // Sort dates
    const sortedDates = Object.keys(dailyCollections).sort();
    const trendData = sortedDates.map(date => dailyCollections[date]);
    const trendLabels = sortedDates.map(date => new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

    const ctxTrend = document.getElementById('collectionsTrendChart') as HTMLCanvasElement;
    if (ctxTrend) {
      this.charts['collectionsTrend'] = new Chart(ctxTrend, {
        type: 'line',
        data: {
          labels: trendLabels,
          datasets: [{
            label: 'Amount Collected (₹)',
            data: trendData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 3,
            tension: 0.4,
            fill: true,
            pointHitRadius: 50 // Makes points much easier to tap on mobile
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false, // Shows tooltip even if not exactly on the point
          },
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    }

    // 2. Loan Status Distribution
    let active = 0, closed = 0, defaultStatus = 0;
    this.loans.forEach(loan => {
      const status = loan.status?.toLowerCase();
      if (status === 'active') active++;
      else if (status === 'closed') closed++;
      else if (status === 'default') defaultStatus++;
    });

    const ctxStatus = document.getElementById('loanStatusChart') as HTMLCanvasElement;
    if (ctxStatus) {
      this.charts['loanStatus'] = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
          labels: ['Active', 'Closed', 'Default'],
          datasets: [{
            data: [active, closed, defaultStatus],
            backgroundColor: ['#10b981', '#64748b', '#ef4444'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });
    }

    // 3. Disbursed vs Collected
    const disbursed = Number(this.dashboardStats?.total_loans_given || 0);
    const collected = Number(this.dashboardStats?.total_collections_all_time || 0);

    const ctxIncExp = document.getElementById('incomeExpenseChart') as HTMLCanvasElement;
    if (ctxIncExp) {
      this.charts['incomeExpense'] = new Chart(ctxIncExp, {
        type: 'bar',
        data: {
          labels: ['Loan Disbursed', 'Collection'],
          datasets: [{
            data: [disbursed, collected],
            backgroundColor: ['#14b8a6', '#8b5cf6'],
            borderRadius: 8,
            maxBarThickness: 60
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    }

    // 4. Employee Analytics (Stacked Bar Chart)
    const employeeData = this.getEmployeeCollectionSummary();
    const empLabels = employeeData.map(e => e.name);
    const empCashData = employeeData.map(e => e.cashTotal);
    const empOnlineData = employeeData.map(e => e.onlineTotal);

    const ctxEmp = document.getElementById('employeePerformanceChart') as HTMLCanvasElement;
    if (ctxEmp) {
      if (this.charts['employeePerformance']) this.charts['employeePerformance'].destroy();
      this.charts['employeePerformance'] = new Chart(ctxEmp, {
        type: 'bar',
        data: {
          labels: empLabels,
          datasets: [
            {
              label: 'Cash Collections (₹)',
              data: empCashData,
              backgroundColor: '#10b981', // green
              maxBarThickness: 50
            },
            {
              label: 'Online Collections (₹)',
              data: empOnlineData,
              backgroundColor: '#3b82f6', // blue
              maxBarThickness: 50
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' }
          },
          scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true }
          }
        }
      });
    }
  }

  // --- Customer Manage Actions (Edit & Delete) ---
  manageCustomer(customer: any) {
    this.selectedCustomerForManage = customer;
    this.editCustomerForm.patchValue({
      name: customer.name,
      mobile_number: customer.mobile_number,
      place: customer.place,
      father_name: customer.father_name || '',
      aadhaar_number: customer.aadhaar_number || '',
      pan_number: customer.pan_number || '',
      address: customer.address || '',
      occupation: customer.occupation || '',
      guarantor_name: customer.guarantor_name || '',
      guarantor_mobile: customer.guarantor_mobile || '',
      collection_days: customer.collection_days || 'Daily',
      notes: customer.notes || ''
    });
    this.isEditCustomerOpen = true;
  }

  async onUpdateCustomer() {
    if (this.editCustomerForm.invalid || !this.selectedCustomerForManage) return;

    const loader = await this.loadingCtrl.create({
      message: 'Updating customer profile...',
      spinner: 'crescent'
    });
    await loader.present();

    const payload = {
      ...this.editCustomerForm.value,
      uuid: this.selectedCustomerForManage.uuid,
      organization_uuid: this.currentUser?.organization_uuid
    };

    const isOnline = await this.syncService.checkActualConnection();

    if (isOnline) {
      this.apiService.updateCustomer(payload.uuid, payload).subscribe({
        next: async () => {
          loader.dismiss();
          await this.dbService.saveCustomer({
            ...payload,
            sync_status: 'Synced'
          });
          this.isEditCustomerOpen = false;
          this.loadData();
          this.showToast('Customer profile updated successfully', 'success');
        },
        error: async (err) => {
          loader.dismiss();
          this.showToast(err?.error?.error || 'Failed to update customer', 'danger');
        }
      });
    } else {
      await this.dbService.saveCustomer({
        ...payload,
        sync_status: 'Pending'
      });
      await this.dbService.addToSyncQueue({
        table_name: 'customers',
        record_uuid: payload.uuid,
        action: 'UPDATE',
        payload: JSON.stringify(payload)
      });
      loader.dismiss();
      this.isEditCustomerOpen = false;
      this.loadData();
      this.showToast('Updated locally. Will sync when online.', 'warning');
    }
  }


  manageLoan(loan: any) {
    this.selectedLoanForManage = loan;
    this.editLoanForm.patchValue({
      accno: loan.accno,
      loan_amount: loan.loan_amount,
      interest_rate: loan.interest_rate,
      interest_amount: loan.interest_amount,
      total_repayable: loan.total_repayable,
      status: loan.status
    });
    this.isEditLoanOpen = true;
  }

  async onUpdateLoan() {
    const rawForm = this.editLoanForm.getRawValue();

    if (this.editLoanForm.invalid || !this.selectedLoanForManage) {
      this.showToast('Verify all required fields are filled', 'warning');
      return;
    }

    const loader = await this.loadingCtrl.create({
      message: 'Fetching location and saving...',
      spinner: 'crescent'
    });
    await loader.present();

    let latitude = null;
    let longitude = null;

    try {
      const position: any = await Promise.race([
        Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Location timeout')), 15500))
      ]);
      latitude = position.coords.latitude;
      longitude = position.coords.longitude;
    } catch (err) {
      console.warn('Could not fetch location during loan update:', err);
    }

    const payload = {
      ...rawForm,
      latitude,
      longitude
    };

    this.apiService.updateLoan(this.selectedLoanForManage.uuid, payload).subscribe({
      next: async () => {
        loader.dismiss();
        this.isEditLoanOpen = false;
        const newStatus = payload.status;
        const loanUuid = this.selectedLoanForManage.uuid;
        this.loadData();
        this.showToast('Loan details updated successfully', 'success');

        if (newStatus === 'closed') {
          this.selectedLoanTab = 'cleared';
          this.highlightedLoanUuid = loanUuid;
          setTimeout(() => {
            const el = document.getElementById('loan-card-' + loanUuid);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 300);
          setTimeout(() => {
            if (this.highlightedLoanUuid === loanUuid) {
              this.highlightedLoanUuid = null;
            }
          }, 3000);
        }
      },
      error: async (err) => {
        loader.dismiss();
        this.showToast(err?.error?.error || 'Failed to update loan details', 'danger');
      }
    });
  }


  // --- Account Numbers Grid Navigation ---
  getActiveLoans() {
    return this.loans.filter(l => l.status === 'active').sort((a, b) => {
      const numA = Number(a.accno);
      const numB = Number(b.accno);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numB - numA;
      }
      return String(b.accno).localeCompare(String(a.accno));
    });
  }

  scrollToLoan(loanUuid: string) {
    this.isAccountsGridOpen = false;
    this.selectedLoanTab = 'active'; // Switch to active tab so the loan is visible
    this.highlightedLoanUuid = loanUuid;

    setTimeout(() => {
      const el = document.getElementById('loan-card-' + loanUuid);
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
  directoryEmployeeSearchQuery = '';

  // Cached calculated arrays to prevent UI freezing
  cachedAllCollectionsSorted: any[] = [];
  cachedEmployeeCollectionSummary: any[] = [];
  cachedFilteredExpenses: any[] = [];
  cachedTotalFilteredCollectionAmount: number = 0;
  
  updateCachedCalculations() {
    this.cachedAllCollectionsSorted = this.getAllCollectionsSorted();
    this.cachedEmployeeCollectionSummary = this.getEmployeeCollectionSummary();
    this.cachedFilteredExpenses = this.getFilteredExpenses();
    this.cachedTotalFilteredCollectionAmount = this.getTotalFilteredCollectionAmount();
  }

  getActiveLoansCountForCustomer(customerUuid: string): number {
    return this.loans.filter(l => l.customer_uuid === customerUuid && l.status === 'active').length;
  }

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

  getFilteredEmployees(): any[] {
    if (!this.directoryEmployeeSearchQuery) return this.employees;
    const q = this.directoryEmployeeSearchQuery.toLowerCase();
    return this.employees.filter(e =>
      e.name.toLowerCase().includes(q) || e.username.toLowerCase().includes(q)
    );
  }

  getActiveLoansList(): any[] {
    const list = this.loans.filter(l => l.status === 'active');

    list.sort((a, b) => {
      const balA = this.getLoanBalance(a) <= 0 ? 0 : 1;
      const balB = this.getLoanBalance(b) <= 0 ? 0 : 1;
      if (balA !== balB) return balA - balB; // 0 balance comes first

      const numA = Number(a.accno);
      const numB = Number(b.accno);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numB - numA;
      }
      return String(b.accno).localeCompare(String(a.accno));
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
      const numA = Number(a.accno);
      const numB = Number(b.accno);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numB - numA;
      }
      return String(b.accno).localeCompare(String(a.accno));
    });
    if (!this.directoryLoanSearchQuery) return list;
    const q = this.directoryLoanSearchQuery.toLowerCase();
    return list.filter(l =>
      l.accno.toLowerCase().includes(q) || l.customer_name.toLowerCase().includes(q)
    );
  }

  getTodayCollections(): any[] {
    const today = new Date().setHours(0, 0, 0, 0);
    return this.collections.filter(c => {
      const colDate = new Date(c.collection_date).setHours(0, 0, 0, 0);
      return colDate === today;
    });
  }

  collectionFilterDate: string = this.getLocalISODate();

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

  getAllCollectionsSorted(): any[] {
    let filtered = [...this.collections];
    if (this.collectionFilterDate) {
      // Ensure we only compare the YYYY-MM-DD part
      const filterDateObj = new Date(this.collectionFilterDate);
      if (!isNaN(filterDateObj.getTime())) {
        const fy = filterDateObj.getFullYear();
        const fm = (filterDateObj.getMonth() + 1).toString().padStart(2, '0');
        const fday = filterDateObj.getDate().toString().padStart(2, '0');
        const formattedFilterDate = `${fy}-${fm}-${fday}`;

        filtered = filtered.filter(c => {
          const d = new Date(c.collection_date);
          const y = d.getFullYear();
          const m = (d.getMonth() + 1).toString().padStart(2, '0');
          const day = d.getDate().toString().padStart(2, '0');
          return `${y}-${m}-${day}` === formattedFilterDate;
        });
      }
    }

    return filtered.sort((a, b) => {
      return new Date(b.collection_date).getTime() - new Date(a.collection_date).getTime();
    });
  }

  getTotalFilteredCollectionAmount(): number {
    return this.getAllCollectionsSorted().reduce((sum, col) => sum + (parseFloat(col.collected_amount) || 0), 0);
  }

  getFilteredExpenses() {
    let list = [...this.allExpenses];
    if (this.expenseFilterDate) {
      const filterDate = new Date(this.expenseFilterDate).toDateString();
      list = list.filter(e => new Date(e.expense_date).toDateString() === filterDate);
    }
    return list.sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());
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
      if (type.toLowerCase() === 'online') {
        stat.onlineTotal += amt;
      } else {
        stat.cashTotal += amt;
      }
    });

    const result = Array.from(summaryMap.entries()).map(([name, stats]) => {
      return { name, count: stats.count, total: stats.total, cashTotal: stats.cashTotal, onlineTotal: stats.onlineTotal };
    });

    return result.sort((a, b) => b.total - a.total);
  }

  exportToExcel() {
    const data = this.getAllCollectionsSorted();
    if (data.length === 0) return;

    let csvContent = 'Account No,Name,Amount,Type,Place,Date and Time\n';

    data.forEach(col => {
      const d = new Date(col.collection_date);
      const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
      const timeStr = d.toLocaleTimeString();
      const amt = col.collected_amount;
      const place = col.customer_place || 'N/A';
      const dateTimeStr = `${dateStr} ${timeStr}`;

      const row = `"${col.accno}","${col.customer_name}","${amt}","${col.payment_type || 'Cash'}","${place}","${dateTimeStr}"`;
      csvContent += row + '\n';
    });

    const datePostfix = this.collectionFilterDate ? this.collectionFilterDate : 'All';
    const filename = `Collections_${datePostfix}.csv`;
    const base64Str = btoa(unescape(encodeURIComponent(csvContent)));
    this.downloadFileToDevice(base64Str, filename, 'text/csv');
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

        place,
        `${`${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`} ${d.toLocaleTimeString()}`
      ];
    });

    autoTable(doc, {
      head: [['Account No', 'Name', 'Amount', 'Type', 'Place', 'Date & Time']],
      body: tableData,
      startY: 20,
    });

    const filename = `Collections_${formattedDatePostfix.replace(/\//g, '-')}.pdf`;
    const base64Str = btoa(doc.output());
    this.downloadFileToDevice(base64Str, filename, 'application/pdf');
  }

  async downloadFileToDevice(dataBase64: string, filename: string, mimeType: string) {
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await Filesystem.writeFile({
          path: filename,
          data: dataBase64,
          directory: Directory.Documents
        });
        this.showToast(`File downloaded to Documents folder: ${filename}`, 'success');
      } catch (e) {
        console.error('Error saving file', e);
        this.showToast('Error saving file on device.', 'danger');
      }
    } else {
      // Web fallback
      const byteCharacters = atob(dataBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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
    const rawForm: any = this.loanForm.getRawValue();

    if (this.loanForm.invalid) {
      this.showToast('Please verify all required fields are filled', 'warning');
      return;
    }

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

  async onCreateEmployee() {
    if (this.employeeForm.invalid) return;

    const loader = await this.loadingCtrl.create({
      message: 'Creating employee account...',
      spinner: 'crescent'
    });
    await loader.present();

    this.apiService.createEmployee(this.employeeForm.value).subscribe({
      next: async () => {
        loader.dismiss();
        this.isAddEmployeeOpen = false;
        this.employeeForm.reset({
          can_disburse_loans: true,
          can_collect_payments: true,
          can_view_reports: false,
          can_view_total_collections: false,
          can_view_defaulters: false,
          can_view_maps: true
        });
        this.loadData();

        this.showToast('Employee registered successfully', 'success');
      },
      error: async (err) => {
        loader.dismiss();
        this.showToast(err?.error?.error || 'Failed to create employee', 'danger');
      }
    });
  }

  openPermissionsModal(emp: any) {
    this.selectedEmployeeForPermissions = emp;
    this.permissionForm.patchValue({
      can_disburse_loans: emp.can_disburse_loans === 1 || emp.can_disburse_loans === true,
      can_collect_payments: emp.can_collect_payments === 1 || emp.can_collect_payments === true,
      can_view_reports: emp.can_view_reports === 1 || emp.can_view_reports === true,
      can_view_total_collections: emp.can_view_total_collections === 1 || emp.can_view_total_collections === true,
      can_view_defaulters: emp.can_view_defaulters === 1 || emp.can_view_defaulters === true,
      can_view_maps: emp.can_view_maps === 1 || emp.can_view_maps === true
    });
    this.isManagePermissionsOpen = true;
  }

  async onUpdatePermissions() {
    if (!this.selectedEmployeeForPermissions) return;

    const loader = await this.loadingCtrl.create({
      message: 'Updating permissions...',
      spinner: 'crescent'
    });
    await loader.present();

    this.apiService.updateEmployeePermissions(this.selectedEmployeeForPermissions.uuid, this.permissionForm.value).subscribe({
      next: async () => {
        loader.dismiss();
        this.isManagePermissionsOpen = false;
        this.loadData();
        this.showToast('Permissions updated successfully', 'success');
      },
      error: async (err) => {
        loader.dismiss();
        this.showToast(err?.error?.error || 'Failed to update permissions', 'danger');
      }
    });
  }

  openEditEmployeeModal(emp: any) {
    this.selectedEditEmployee = emp;
    this.editEmployeeForm.patchValue({
      name: emp.name,
      mobile_number: emp.mobile_number
    });
    this.isEditEmployeeOpen = true;
  }

  async onEditEmployee() {
    if (this.editEmployeeForm.invalid || !this.selectedEditEmployee) return;
    const loading = await this.loadingCtrl.create({ message: 'Updating...' });
    await loading.present();

    this.apiService.updateEmployee(this.selectedEditEmployee.uuid, this.editEmployeeForm.value).subscribe({
      next: () => {
        loading.dismiss();
        this.showToast('Employee updated successfully', 'success');
        this.isEditEmployeeOpen = false;
        this.loadData();
      },
      error: (err) => {
        loading.dismiss();
        this.showToast('Failed to update employee', 'danger');
      }
    });
  }

  async toggleStatus(employee: any) {
    const newStatus = employee.status === 'active' ? 'disabled' : 'active';
    const alert = await this.alertCtrl.create({
      header: newStatus === 'active' ? 'Activate Employee' : 'Disable Employee',
      message: `Are you sure you want to ${newStatus} ${employee.name}?`,
      cssClass: 'custom-glass-alert',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: newStatus === 'active' ? 'Activate' : 'Disable',
          role: newStatus === 'active' ? 'confirm' : 'destructive',
          handler: () => {
            this.apiService.toggleEmployeeStatus(employee.uuid, newStatus).subscribe({
              next: async () => {
                employee.status = newStatus;
                this.showToast(`Status updated to ${newStatus}`, 'success');
              },
              error: async (err) => {
                this.showToast(err?.error?.error || 'Failed to update status', 'danger');
              }
            });
          }
        }
      ]
    });
    await alert.present();
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
        Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Location timeout')), 5500))
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

  // --- Edit Collection Features ---
  openEditCollectionModal(col: any) {
    this.selectedEditCollection = col;
    // Format date for datetime-local input in local timezone
    const d = new Date(col.collection_date);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);

    this.editCollectionForm.patchValue({
      collected_amount: col.collected_amount,
      collection_date: localISOTime,
      payment_type: col.payment_type || 'Cash'
    });

    this.isEditCollectionOpen = true;
  }

  closeEditCollectionModal() {
    this.isEditCollectionOpen = false;
    this.selectedEditCollection = null;
    this.editCollectionForm.reset();
  }

  async onSubmitEditCollection() {
    if (this.editCollectionForm.invalid || !this.selectedEditCollection) return;

    const payload = this.editCollectionForm.value;

    const loader = await this.loadingCtrl.create({
      message: 'Fetching location & updating...',
      spinner: 'crescent'
    });
    await loader.present();

    let latitude = null;
    let longitude = null;
    try {
      const position: any = await Promise.race([
        Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Location timeout')), 5500))
      ]);
      latitude = position.coords.latitude;
      longitude = position.coords.longitude;
    } catch (err) {
      console.warn('Could not fetch location during collection edit:', err);
    }

    const finalPayload = {
      ...payload,
      latitude,
      longitude
    };

    const actuallyOnline = await this.syncService.checkActualConnection();
    if (actuallyOnline) {
      this.apiService.updateCollection(this.selectedEditCollection.uuid, finalPayload).subscribe({
        next: async () => {
          loader.dismiss();
          this.showToast('Collection updated successfully', 'success');
          this.closeEditCollectionModal();
          this.loadData();
        },
        error: async (err) => {
          loader.dismiss();
          this.showToast(err?.error?.error || 'Failed to update collection', 'danger');
        }
      });
    } else {
      loader.dismiss();
      this.showToast('Must be online to edit collections', 'warning');
    }
  }

  generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
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
        this.expenseForm.reset(); // Reset form on success
        this.showToast('Expense recorded successfully', 'success');
        this.apiService.getAllExpenses().subscribe({
          next: (res) => this.allExpenses = res
        });
        this.loadDashboardStats();
        if (this.cashbookDate) this.loadCashbook();
      },
      error: async (err) => {
        loader.dismiss();
        this.showToast(err?.error?.error || 'Failed to record expense', 'danger');
      }
    });
  }

  async onRecordInvestment() {
    if (this.investmentForm.invalid) return;

    const loader = await this.loadingCtrl.create({
      message: 'Recording investment...',
      spinner: 'crescent'
    });
    await loader.present();

    this.apiService.addInvestment(this.investmentForm.value).subscribe({
      next: async () => {
        loader.dismiss();
        this.isAddInvestmentOpen = false;
        this.investmentForm.reset();
        this.showToast('Investment recorded successfully', 'success');
        this.apiService.getInvestments().subscribe({
          next: (res) => this.investments = res
        });
        if (this.cashbookDate) this.loadCashbook();
      },
      error: async (err) => {
        loader.dismiss();
        this.showToast(err?.error?.error || 'Failed to record investment', 'danger');
      }
    });
  }

  openEditExpenseModal(expense: any) {
    this.selectedExpenseForEdit = expense;
    this.editExpenseForm.patchValue({
      amount: expense.amount,
      reason: expense.reason
    });
    this.isEditExpenseOpen = true;
  }

  closeEditExpenseModal() {
    this.isEditExpenseOpen = false;
    this.selectedExpenseForEdit = null;
    this.editExpenseForm.reset();
  }

  async onUpdateExpense() {
    if (this.editExpenseForm.invalid || !this.selectedExpenseForEdit) return;

    const loader = await this.loadingCtrl.create({ message: 'Updating expense...' });
    await loader.present();

    this.apiService.updateExpense(this.selectedExpenseForEdit.uuid, this.editExpenseForm.value).subscribe({
      next: async () => {
        loader.dismiss();
        this.showToast('Expense updated successfully', 'success');
        this.closeEditExpenseModal();
        this.apiService.getAllExpenses().subscribe({ next: (res) => this.allExpenses = res });
        this.loadDashboardStats();
        if (this.cashbookDate) this.loadCashbook();
      },
      error: async (err) => {
        loader.dismiss();
        this.showToast(err?.error?.error || 'Failed to update expense', 'danger');
      }
    });
  }

  async onDeleteExpense(uuid: string) {
    const alert = await this.alertCtrl.create({
      header: 'Confirm Delete',
      message: 'Are you sure you want to delete this expense? This action cannot be undone.',
      cssClass: 'custom-glass-alert',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            const loader = await this.loadingCtrl.create({ message: 'Deleting expense...' });
            await loader.present();

            this.apiService.deleteExpense(uuid).subscribe({
              next: async () => {
                loader.dismiss();
                this.showToast('Expense deleted successfully', 'success');
                this.apiService.getAllExpenses().subscribe({ next: (res) => this.allExpenses = res });
                this.loadDashboardStats();
                if (this.cashbookDate) this.loadCashbook();
              },
              error: async (err) => {
                loader.dismiss();
                this.showToast(err?.error?.error || 'Failed to delete expense', 'danger');
              }
            });
          }
        }
      ]
    });
    await alert.present();
  }

  openEditInvestmentModal(investment: any) {
    this.selectedInvestmentForEdit = investment;
    this.editInvestmentForm.patchValue({
      amount: investment.amount,
      source: investment.source
    });
    this.isEditInvestmentOpen = true;
  }

  closeEditInvestmentModal() {
    this.isEditInvestmentOpen = false;
    this.selectedInvestmentForEdit = null;
    this.editInvestmentForm.reset();
  }

  async onUpdateInvestment() {
    if (this.editInvestmentForm.invalid || !this.selectedInvestmentForEdit) return;

    const loader = await this.loadingCtrl.create({ message: 'Updating investment...' });
    await loader.present();

    this.apiService.updateInvestment(this.selectedInvestmentForEdit.uuid, this.editInvestmentForm.value).subscribe({
      next: async () => {
        loader.dismiss();
        this.showToast('Investment updated successfully', 'success');
        this.closeEditInvestmentModal();
        this.apiService.getInvestments().subscribe({ next: (res) => this.investments = res });
        this.loadDashboardStats();
        if (this.cashbookDate) this.loadCashbook();
      },
      error: async (err) => {
        loader.dismiss();
        this.showToast(err?.error?.error || 'Failed to update investment', 'danger');
      }
    });
  }

  openChangeMyPasswordModal() {
    this.isChangeMyPasswordOpen = true;
  }

  closeChangeMyPasswordModal() {
    this.isChangeMyPasswordOpen = false;
    this.changeMyPasswordForm.reset();
  }

  async onChangeMyPassword() {
    if (this.changeMyPasswordForm.invalid) return;
    const loader = await this.loadingCtrl.create({ message: 'Updating password...' });
    await loader.present();

    this.apiService.changeMyPassword(this.changeMyPasswordForm.value).subscribe({
      next: async (res) => {
        loader.dismiss();
        this.showToast('Password updated successfully', 'success');
        this.closeChangeMyPasswordModal();
      },
      error: async (err) => {
        loader.dismiss();
        this.showToast(err?.error?.error || 'Failed to update password', 'danger');
      }
    });
  }

  openResetPasswordModal(emp: any) {
    this.selectedEmployeeForReset = emp;
    this.isResetEmployeePasswordOpen = true;
  }

  closeResetEmployeePasswordModal() {
    this.isResetEmployeePasswordOpen = false;
    this.selectedEmployeeForReset = null;
    this.resetEmployeePasswordForm.reset();
  }

  async onResetEmployeePassword() {
    if (this.resetEmployeePasswordForm.invalid || !this.selectedEmployeeForReset) return;
    const loader = await this.loadingCtrl.create({ message: 'Resetting password...' });
    await loader.present();

    this.apiService.resetEmployeePassword(this.selectedEmployeeForReset.uuid, this.resetEmployeePasswordForm.value).subscribe({
      next: async (res) => {
        loader.dismiss();
        this.showToast('Employee password reset successfully', 'success');
        this.closeResetEmployeePasswordModal();
      },
      error: async (err) => {
        loader.dismiss();
        this.showToast(err?.error?.error || 'Failed to reset employee password', 'danger');
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

  async openProfileMenu() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: this.currentUser?.name || 'Profile',
      subHeader: this.currentUser?.organization_name || 'Workspace',
      cssClass: 'custom-action-sheet',
      buttons: [
        {
          text: 'Change Password',
          icon: 'key-outline',
          handler: () => {
            this.openChangeMyPasswordModal();
          }
        },
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

  // ==== BULK IMPORT FUNCTIONS ==== //
  latestBatchId: string | null = null;
  isRevertingBatch: boolean = false;

  downloadImportTemplate() {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Loans
    const loansData = [
      ['accno', 'name', 'phone', 'place', 'loan_amount', 'interest_amount', 'loan_date']
    ];
    const wsLoans = XLSX.utils.aoa_to_sheet(loansData);
    // Lock/freeze the top header row
    wsLoans['!views'] = [{ state: 'frozen', ySplit: 1 }];
    wsLoans['!freeze'] = { ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, wsLoans, 'Loans');

    // Sheet 2: Transactions
    const transactionsData = [
      ['accno', 'collection_amount', 'collection_date']
    ];
    const wsTransactions = XLSX.utils.aoa_to_sheet(transactionsData);
    // Lock/freeze the top header row
    wsTransactions['!views'] = [{ state: 'frozen', ySplit: 1 }];
    wsTransactions['!freeze'] = { ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, wsTransactions, 'Transactions');

    // Generate Excel file
    XLSX.writeFile(wb, 'LendFlow_Bulk_Import_Template.xlsx');
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.bulkImportFile = file;
      this.importResults = null;
      this.parsedLoansPreview = [];
      this.parsedTransactionsPreview = [];
      this.previewExcelData();
    }
  }

  previewExcelData() {
    if (!this.bulkImportFile) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      setTimeout(() => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });

          // Parse Loans Sheet
          if (workbook.SheetNames.includes('Loans')) {
            const wsLoans = workbook.Sheets['Loans'];
            const rawLoans = XLSX.utils.sheet_to_json(wsLoans, { raw: true });
            
            this.parsedLoansPreview = rawLoans.map((loan: any) => {
              let formattedDate = loan.loan_date;
              if (typeof formattedDate === 'number') {
                const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                const jsDate = new Date(excelEpoch.getTime() + formattedDate * 86400000);
                const d = jsDate.getUTCDate().toString().padStart(2, '0');
                const m = (jsDate.getUTCMonth() + 1).toString().padStart(2, '0');
                const y = jsDate.getUTCFullYear();
                formattedDate = `${d}/${m}/${y}`;
              } else if (typeof formattedDate === 'string') {
                formattedDate = formattedDate.replace(/-/g, '/');
              }
              
              return {
                ...loan,
                loan_date: formattedDate || ''
              };
            });
          }

          // Parse Transactions Sheet
          this.previewTotalTransactions = 0;
          if (workbook.SheetNames.includes('Transactions')) {
            const wsTransactions = workbook.Sheets['Transactions'];
            // use raw: true to get accurate types (numbers for dates)
            const txList: any[] = XLSX.utils.sheet_to_json(wsTransactions, { raw: true });
            
            this.parsedTransactionsPreview = txList.map(tx => {
              // Add to total
              this.previewTotalTransactions += parseFloat(tx.collection_amount) || 0;
              
              // Format date strictly to DD/MM/YYYY
              let formattedDate = tx.collection_date;
              if (typeof formattedDate === 'number') {
                const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                const jsDate = new Date(excelEpoch.getTime() + formattedDate * 86400000);
                const d = jsDate.getUTCDate().toString().padStart(2, '0');
                const m = (jsDate.getUTCMonth() + 1).toString().padStart(2, '0');
                const y = jsDate.getUTCFullYear();
                formattedDate = `${d}/${m}/${y}`;
              } else if (typeof formattedDate === 'string') {
                // Convert any DD-MM-YYYY to DD/MM/YYYY
                formattedDate = formattedDate.replace(/-/g, '/');
              }
              
              return {
                ...tx,
                collection_date: formattedDate
              };
            });
          }
        } catch (err) {
          console.error('Excel parse error:', err);
          this.showToast('Error parsing Excel file for preview.', 'danger');
        }
      }, 0);
    };
    reader.readAsArrayBuffer(this.bulkImportFile);
  }

  processBulkImport() {
    if (!this.bulkImportFile) return;

    this.isUploadingBulk = true;
    this.importResults = null;

    if (this.parsedLoansPreview.length === 0 && this.parsedTransactionsPreview.length === 0) {
      this.isUploadingBulk = false;
      this.showToast('No data found to import.', 'danger');
      return;
    }

    this.apiService.bulkImportExcel({ 
      loans: this.parsedLoansPreview, 
      transactions: this.parsedTransactionsPreview 
    }).subscribe({
      next: (res: any) => {
        this.isUploadingBulk = false;
        this.importResults = res;
        this.latestBatchId = res.batch_id || null;
        this.showToast('Bulk import completed.', 'success');
        this.parsedLoansPreview = [];
        this.parsedTransactionsPreview = [];
        this.bulkImportFile = null;
        this.loadData();
      },
      error: (err: any) => {
        this.isUploadingBulk = false;
        this.showToast(err.error?.error || 'Failed to process bulk import', 'danger');
      }
    });
  }

  async undoLastUpload() {
    if (!this.latestBatchId) return;

    this.isRevertingBatch = true;
    this.apiService.revertBulkImport(this.latestBatchId).subscribe({
      next: (res: any) => {
        this.isRevertingBatch = false;
        this.latestBatchId = null;
        this.importResults = null;
        this.showToast('Bulk upload successfully undone. All inserted records removed.', 'success');
        this.loadData();
      },
      error: (err: any) => {
        this.isRevertingBatch = false;
        this.showToast(err.error?.error || 'Failed to undo upload.', 'danger');
      }
    });
  }
}

