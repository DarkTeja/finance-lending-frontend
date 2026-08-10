import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(private router: Router, private apiService: ApiService) {}

  saveSession(token: string, user: any) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }

  getCurrentUser() {
    const data = localStorage.getItem('user');
    return data ? JSON.parse(data) : null;
  }

  getToken() {
    return localStorage.getItem('token');
  }

  updateUser(user: any) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout() {
    if (this.isLoggedIn()) {
      // Unregister device token to prevent push notification leaks to next user
      this.apiService.unregisterPushToken().subscribe({
        next: () => this.clearLocalSession(),
        error: (err) => {
          console.error('Failed to unregister push token:', err);
          this.clearLocalSession();
        }
      });
    } else {
      this.clearLocalSession();
    }
  }

  private clearLocalSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Clear user cache
    localStorage.removeItem('money_lending_user');
    
    this.router.navigate(['/login']);
  }
}
