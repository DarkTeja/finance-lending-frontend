import { Component, OnInit } from '@angular/core';
import { IonicModule, ToastController, LoadingController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule, RouterModule]
})
export class ForgotPasswordPage implements OnInit {
  forgotPasswordForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private router: Router
  ) { }

  ngOnInit() {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  async onForgotPassword() {
    if (this.forgotPasswordForm.invalid) return;

    const loader = await this.loadingCtrl.create({
      message: 'Sending reset link...',
      spinner: 'crescent'
    });
    await loader.present();

    this.apiService.forgotPassword(this.forgotPasswordForm.value).subscribe({
      next: async (res) => {
        loader.dismiss();
        const toast = await this.toastCtrl.create({
          message: 'Password reset link has been sent to your email.',
          duration: 3000,
          color: 'success',
          position: 'bottom'
        });
        await toast.present();
        this.router.navigate(['/login']);
      },
      error: async (err) => {
        loader.dismiss();
        console.error('Forgot password error:', err);
        const errMsg = err?.error?.error || 'Failed to send reset link';
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
