import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule, ToastController, LoadingController, Platform } from '@ionic/angular';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule, RouterModule]
})
export class LoginPage implements OnInit {
  loginForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private platform: Platform
  ) {}

  ngOnInit() {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  ionViewWillEnter() {
    if (this.authService.isLoggedIn()) {
      const user = this.authService.getCurrentUser();
      if (user?.role === 'superadmin') {
        this.router.navigate(['/superadmin-dashboard']);
      } else if (user?.role === 'admin') {
        this.router.navigate(['/admin-dashboard']);
      } else if (user?.role === 'employee') {
        this.router.navigate(['/employee-dashboard']);
      }
    }
  }

  async onSubmit() {
    if (this.loginForm.invalid) return;

    const loader = await this.loadingCtrl.create({
      message: 'Authenticating...',
      spinner: 'crescent'
    });
    await loader.present();

    this.apiService.login(this.loginForm.value).subscribe({
      next: async (res) => {
        loader.dismiss();
        this.authService.saveSession(res.token, res.user);

        // Request Push Notification permissions for admins on Android
        if ((res.user.role === 'admin' || res.user.role === 'superadmin') && this.platform.is('capacitor')) {
          import('@capacitor/push-notifications').then(({ PushNotifications }) => {
            PushNotifications.requestPermissions().then((perm) => {
              if (perm.receive === 'granted') {
                PushNotifications.register();
              }
            });
          }).catch(err => console.warn('Push not supported', err));
        }

        const toast = await this.toastCtrl.create({
          message: `Welcome back, ${res.user.name}!`,
          duration: 2000,
          color: 'success',
          position: 'bottom'
        });
        await toast.present();

        if (res.user.role === 'superadmin') {
          this.router.navigate(['/superadmin-dashboard']);
        } else if (res.user.role === 'admin') {
          this.router.navigate(['/admin-dashboard']);
        } else {
          this.router.navigate(['/employee-dashboard']);
        }
      },
      error: async (err) => {
        loader.dismiss();
        console.error('Login error:', err);
        const errMsg = err?.error?.error || 'Authentication failed';
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
