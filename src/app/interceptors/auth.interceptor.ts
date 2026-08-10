import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private router: Router, private toastCtrl: ToastController) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && error.error && error.error.error === 'Your account is logged in on another device') {
          this.handleUnauthorized(error.error.error);
        } else if (error.status === 401 && error.error && error.error.error === 'Token is invalid or expired') {
          this.handleUnauthorized('Your session has expired. Please log in again.');
        } else if (error.status === 401) {
            // General 401 fallback
            this.handleUnauthorized('Unauthorized. Please log in again.');
        }
        return throwError(() => error);
      })
    );
  }

  private async handleUnauthorized(message: string) {
    // Clear session
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('money_lending_user');

    // Show Toast
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 4000,
      color: 'danger',
      position: 'bottom'
    });
    await toast.present();

    // Redirect to login
    this.router.navigate(['/login']);
  }
}
