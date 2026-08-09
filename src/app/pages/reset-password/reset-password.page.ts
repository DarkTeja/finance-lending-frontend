import { Component, OnInit } from '@angular/core';
import { IonicModule, ToastController, LoadingController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule, RouterModule]
})
export class ResetPasswordPage implements OnInit {
  resetForm!: FormGroup;
  token: string | null = null;
  isValidating = true;
  isValidToken = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) { }

  ngOnInit() {
    this.resetForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    this.route.queryParams.subscribe(params => {
      this.token = params['token'];
      if (this.token) {
        this.isValidating = false;
        this.isValidToken = true;
      } else {
        this.isValidating = false;
        this.isValidToken = false;
      }
    });
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null : { mismatch: true };
  }

  async onSubmit() {
    if (this.resetForm.invalid || !this.token) return;

    const loader = await this.loadingCtrl.create({
      message: 'Resetting password...',
      spinner: 'crescent'
    });
    await loader.present();

    const data = {
      token: this.token,
      newPassword: this.resetForm.value.password
    };

    this.apiService.resetPassword(data).subscribe({
      next: async (res) => {
        loader.dismiss();
        const toast = await this.toastCtrl.create({
          message: 'Password reset successfully. Please log in.',
          duration: 3000,
          color: 'success',
          position: 'bottom'
        });
        await toast.present();
        this.router.navigate(['/login']);
      },
      error: async (err) => {
        loader.dismiss();
        const errMsg = err?.error?.error || 'Failed to reset password';
        const toast = await this.toastCtrl.create({
          message: errMsg,
          duration: 3000,
          color: 'danger',
          position: 'bottom'
        });
        await toast.present();
      }
    });
  }
}
