import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return false;
    }

    const user = this.authService.getCurrentUser();
    const expectedRole = route.data['expectedRole'];

    if (expectedRole && user.role !== expectedRole) {
      // Redirect to correct dashboard based on role
      if (user.role === 'superadmin') {
        this.router.navigate(['/superadmin-dashboard']);
      } else if (user.role === 'admin') {
        this.router.navigate(['/admin-dashboard']);
      } else {
        this.router.navigate(['/employee-dashboard']);
      }
      return false;
    }

    return true;
  }
}
