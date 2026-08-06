import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule, ToastController, LoadingController, AlertController, MenuController } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { DbService } from '../../services/db.service';
import { SyncService } from '../../services/sync.service';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.page.html',
  styleUrls: ['./admin-dashboard.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule, RouterModule]
})
export class AdminDashboardPage implements OnInit {
  currentUser: any;
  employees: any[] = [];
  customers: any[] = [];
  loans: any[] = [];
  
  activeTab: 'users' | 'customers' | 'loans' | 'collection' | 'reports' = 'users';

  employeeForm!: FormGroup;
  permissionForm!: FormGroup;
  loanForm!: FormGroup;
  editCustomerForm!: FormGroup;
  editLoanForm!: FormGroup;

  isAddEmployeeOpen = false;
  isManagePermissionsOpen = false;
  isAddLoanOpen = false;
  isEditCustomerOpen = false;
  isEditLoanOpen = false;
  isAccountsGridOpen = false;
  highlightedLoanUuid: string | null = null;

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
    private authService: AuthService,
    private dbService: DbService,
    private syncService: SyncService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private menuCtrl: MenuController
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    this.initForms();
    this.setupLoanCalculationListeners();
    this.loadData();
  }

  initForms() {
    this.employeeForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      name: ['', [Validators.required, Validators.minLength(3)]],
      mobile_number: ['', [Validators.pattern('^[0-9]{10}$')]],
      can_disburse_loans: [true],
      can_collect_payments: [true],
      can_view_reports: [false]
    });

    this.permissionForm = this.fb.group({
      can_disburse_loans: [true],
      can_collect_payments: [true],
      can_view_reports: [false]
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
  }

  setupLoanCalculationListeners() {
    // Add Loan form listeners
    this.loanForm.get('loan_amount')?.valueChanges.subscribe(() => this.recalculateFromRate());
    this.loanForm.get('interest_rate')?.valueChanges.subscribe(() => this.recalculateFromRate());
    this.loanForm.get('interest_amount')?.valueChanges.subscribe(() => this.recalculateFromAmount());

    // Edit Loan form listeners
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

  // --- Edit Loan Calculators ---
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

  loadData() {
    this.apiService.getEmployees().subscribe({
      next: (res) => this.employees = res,
      error: (err) => console.error('Error loading employees:', err)
    });

    this.apiService.getCustomers().subscribe({
      next: async (res) => {
        this.customers = res;
        this.filteredCustomersForLoan = [...res];
        
        // Save the freshly fetched organization-specific list to cache, overwriting previous cache
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

  selectTab(tab: 'users' | 'customers' | 'loans' | 'collection' | 'reports') {
    this.activeTab = tab;
    this.menuCtrl.close();
  }

  // --- Customer Manage Actions (Edit & Delete) ---
  async manageCustomer(customer: any) {
    const alert = await this.alertCtrl.create({
      header: `Manage: ${customer.name}`,
      message: 'Choose an option to modify this customer:',
      buttons: [
        {
          text: 'Edit Details',
          handler: () => {
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
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });
    await alert.present();
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


  async manageLoan(loan: any) {
    const alert = await this.alertCtrl.create({
      header: `Manage Loan: ${loan.accno}`,
      message: `Selected Customer: ${loan.customer_name}`,
      buttons: [
        {
          text: 'Edit Details / Status',
          handler: () => {
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
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });
    await alert.present();
  }

  async onUpdateLoan() {
    const rawForm = this.editLoanForm.getRawValue();

    if (this.editLoanForm.invalid || !this.selectedLoanForManage) {
      this.showToast('Verify all required fields are filled', 'warning');
      return;
    }

    const loader = await this.loadingCtrl.create({
      message: 'Saving changes...',
      spinner: 'crescent'
    });
    await loader.present();

    this.apiService.updateLoan(this.selectedLoanForManage.uuid, rawForm).subscribe({
      next: async () => {
        loader.dismiss();
        this.isEditLoanOpen = false;
        this.loadData();
        this.showToast('Loan details updated successfully', 'success');
      },
      error: async (err) => {
        loader.dismiss();
        this.showToast(err?.error?.error || 'Failed to update loan details', 'danger');
      }
    });
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

  getAllCollectionsSorted(): any[] {
    // Return all collections sorted by date descending (newest first)
    return [...this.collections].sort((a, b) => {
      return new Date(b.collection_date).getTime() - new Date(a.collection_date).getTime();
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
          can_view_reports: false
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
      can_view_reports: emp.can_view_reports === 1 || emp.can_view_reports === true
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

  async toggleStatus(employee: any) {
    const newStatus = employee.status === 'active' ? 'disabled' : 'active';
    const alert = await this.alertCtrl.create({
      header: 'Update Status',
      message: `Are you sure you want to set ${employee.name} as ${newStatus}?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Confirm',
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

  // --- Edit Collection Features ---
  openEditCollectionModal(col: any) {
    this.selectedEditCollection = col;
    // Format date for date-local input if needed, or just standard Date
    const d = new Date(col.collection_date);
    const dateFormatted = d.toISOString();

    this.editCollectionForm.patchValue({
      collected_amount: col.collected_amount,
      collection_date: dateFormatted,
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
      message: 'Updating collection...',
      spinner: 'crescent'
    });
    await loader.present();

    const actuallyOnline = await this.syncService.checkActualConnection();
    if (actuallyOnline) {
      this.apiService.updateCollection(this.selectedEditCollection.uuid, payload).subscribe({
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
