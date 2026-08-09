import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AutoLoginGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (this.authService.isLoggedIn()) {
      const user = this.authService.getCurrentUser();
      if (user?.role === 'superadmin') {
        this.router.navigate(['/superadmin-dashboard']);
      } else if (user?.role === 'admin') {
        this.router.navigate(['/admin-dashboard']);
      } else if (user?.role === 'employee') {
        this.router.navigate(['/employee-dashboard']);
      } else {
        this.router.navigate(['/login']);
      }
      return false; // Prevent loading the login page
    }
    return true; // Allow loading the login page if not logged in
  }
}
