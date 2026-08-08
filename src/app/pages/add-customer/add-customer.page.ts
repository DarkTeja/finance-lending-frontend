import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule, ToastController, LoadingController, NavController } from '@ionic/angular';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { DbService } from '../../services/db.service';
import { SyncService } from '../../services/sync.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-add-customer',
  templateUrl: './add-customer.page.html',
  styleUrls: ['./add-customer.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule]
})
export class AddCustomerPage implements OnInit {
  customerForm!: FormGroup;
  isOnline = true;
  currentUser: any;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    public dbService: DbService,
    public syncService: SyncService,
    private authService: AuthService,
    private router: Router,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private navCtrl: NavController
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    this.syncService.isOnline$.subscribe(status => this.isOnline = status);
    this.initForm();
  }

  initForm() {
    this.customerForm = this.fb.group({
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
  }

  // Helper to generate UUID locally offline
  generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async onSubmit() {
    if (this.customerForm.invalid) return;

    const loader = await this.loadingCtrl.create({
      message: 'Saving customer record...',
      spinner: 'crescent'
    });
    await loader.present();

    const customerUuid = this.generateUUID();
    const payload = {
      ...this.customerForm.value,
      uuid: customerUuid,
      organization_uuid: this.currentUser?.organization_uuid
    };

    const actuallyOnline = await this.syncService.checkActualConnection();

    if (actuallyOnline) {
      this.apiService.createCustomer(payload).subscribe({
        next: async (res) => {
          loader.dismiss();
          await this.dbService.saveCustomer({
            ...payload,
            sync_status: 'Synced'
          });
          this.showToast('Customer registered successfully', 'success');
          this.goBack();
        },
        error: async (err) => {
          loader.dismiss();
          console.error('Server upload failed:', err);
          const errMsg = err?.error?.error || 'Database write error. Check if your session expired.';
          this.showToast(`Server Error: ${errMsg}`, 'danger');
        }
      });
    } else {
      await this.saveOffline(payload);
      loader.dismiss();
    }
  }

  async saveOffline(payload: any) {
    await this.dbService.saveCustomer({
      ...payload,
      sync_status: 'Pending'
    });

    await this.dbService.addToSyncQueue({
      table_name: 'customers',
      record_uuid: payload.uuid,
      action: 'INSERT',
      payload: JSON.stringify(payload)
    });

    this.showToast('Saved offline. It will sync when connection returns.', 'warning');
    this.goBack();
  }

  goBack() {
    if (this.currentUser?.role === 'admin') {
      this.navCtrl.navigateBack(['/admin-dashboard']);
    } else {
      this.navCtrl.navigateBack(['/employee-dashboard']);
    }
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
