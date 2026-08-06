import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule, ToastController, LoadingController } from '@ionic/angular';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-superadmin-dashboard',
  templateUrl: './superadmin-dashboard.page.html',
  styleUrls: ['./superadmin-dashboard.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule]
})
export class SuperadminDashboardPage implements OnInit {
  organizations: any[] = [];
  admins: any[] = [];

  orgForm!: FormGroup;
  adminForm!: FormGroup;

  isAddOrgOpen = false;
  isAddAdminOpen = false;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private authService: AuthService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {}

  ngOnInit() {
    this.initForms();
    this.loadData();
  }

  initForms() {
    this.orgForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]]
    });

    this.adminForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      name: ['', [Validators.required, Validators.minLength(3)]],
      mobile_number: ['', [Validators.pattern('^[0-9]{10}$')]],
      organization_uuid: ['', [Validators.required]]
    });
  }

  loadData() {
    this.apiService.getOrganizations().subscribe({
      next: (res) => this.organizations = res,
      error: (err) => console.error('Error loading organizations:', err)
    });

    this.apiService.getAdmins().subscribe({
      next: (res) => this.admins = res,
      error: (err) => console.error('Error loading admins:', err)
    });
  }

  async onCreateOrganization() {
    if (this.orgForm.invalid) return;

    const loader = await this.loadingCtrl.create({
      message: 'Creating organization...',
      spinner: 'crescent'
    });
    await loader.present();

    this.apiService.createOrganization(this.orgForm.value).subscribe({
      next: async () => {
        loader.dismiss();
        this.isAddOrgOpen = false;
        this.orgForm.reset();
        this.loadData();
        this.showToast('Organization created successfully', 'success');
      },
      error: async (err) => {
        loader.dismiss();
        this.showToast(err?.error?.error || 'Failed to create organization', 'danger');
      }
    });
  }

  async onCreateAdmin() {
    if (this.adminForm.invalid) return;

    const loader = await this.loadingCtrl.create({
      message: 'Creating admin account...',
      spinner: 'crescent'
    });
    await loader.present();

    this.apiService.createAdmin(this.adminForm.value).subscribe({
      next: async () => {
        loader.dismiss();
        this.isAddAdminOpen = false;
        this.adminForm.reset();
        this.loadData();
        this.showToast('Admin account created successfully', 'success');
      },
      error: async (err) => {
        loader.dismiss();
        this.showToast(err?.error?.error || 'Failed to create admin', 'danger');
      }
    });
  }

  logout() {
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
