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
  editOrgForm!: FormGroup;
  editAdminForm!: FormGroup;
  changeMyPasswordForm!: FormGroup;

  isAddOrgOpen = false;
  isAddAdminOpen = false;
  isEditOrgOpen = false;
  isEditAdminOpen = false;
  isChangeMyPasswordOpen = false;

  selectedEditOrg: any = null;
  selectedEditAdmin: any = null;

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
      email: ['', [Validators.required, Validators.email]],
      mobile_number: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      organization_uuid: ['', [Validators.required]]
    });

    this.editOrgForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]]
    });

    this.editAdminForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      mobile_number: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      organization_uuid: ['', [Validators.required]]
    });

    this.changeMyPasswordForm = this.fb.group({
      current_password: ['', [Validators.required]],
      new_password: ['', [Validators.required, Validators.minLength(6)]]
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

  openChangeMyPasswordModal() {
    this.isChangeMyPasswordOpen = true;
  }

  closeChangeMyPasswordModal() {
    this.isChangeMyPasswordOpen = false;
    this.changeMyPasswordForm.reset();
  }

  // --- EDIT ORGANIZATION ---
  openEditOrgModal(org: any) {
    this.selectedEditOrg = org;
    this.editOrgForm.patchValue({ name: org.name });
    this.isEditOrgOpen = true;
  }

  async onEditOrganization() {
    if (this.editOrgForm.invalid || !this.selectedEditOrg) return;

    const loader = await this.loadingCtrl.create({ message: 'Updating organization...' });
    await loader.present();

    this.apiService.updateOrganization(this.selectedEditOrg.uuid, this.editOrgForm.value).subscribe({
      next: async () => {
        loader.dismiss();
        this.isEditOrgOpen = false;
        this.loadData();
        this.showToast('Organization updated successfully', 'success');
      },
      error: async (err) => {
        loader.dismiss();
        this.showToast(err?.error?.error || 'Failed to update organization', 'danger');
      }
    });
  }

  // --- EDIT ADMIN ---
  openEditAdminModal(admin: any) {
    this.selectedEditAdmin = admin;
    this.editAdminForm.patchValue({
      name: admin.name,
      email: admin.email,
      mobile_number: admin.mobile_number,
      organization_uuid: admin.organization_uuid || ''
    });
    this.isEditAdminOpen = true;
  }

  async onEditAdmin() {
    if (this.editAdminForm.invalid || !this.selectedEditAdmin) return;

    const loader = await this.loadingCtrl.create({ message: 'Updating admin...' });
    await loader.present();

    this.apiService.updateAdmin(this.selectedEditAdmin.uuid, this.editAdminForm.value).subscribe({
      next: async () => {
        loader.dismiss();
        this.isEditAdminOpen = false;
        this.loadData();
        this.showToast('Admin updated successfully', 'success');
      },
      error: async (err) => {
        loader.dismiss();
        this.showToast(err?.error?.error || 'Failed to update admin', 'danger');
      }
    });
  }

  // --- TOGGLE ADMIN STATUS ---
  async toggleAdminStatus(admin: any) {
    const newStatus = admin.status === 'active' ? 'disabled' : 'active';
    const actionText = newStatus === 'active' ? 'Enabling' : 'Disabling';
    
    const loader = await this.loadingCtrl.create({ message: `${actionText} admin...` });
    await loader.present();

    this.apiService.toggleAdminStatus(admin.uuid, newStatus).subscribe({
      next: async () => {
        loader.dismiss();
        this.loadData();
        this.showToast(`Admin ${newStatus} successfully`, 'success');
      },
      error: async (err) => {
        loader.dismiss();
        this.showToast(err?.error?.error || `Failed to change status`, 'danger');
      }
    });
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
