import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(private router: Router) {}

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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Clear user cache
    localStorage.removeItem('money_lending_user');
    
    this.router.navigate(['/login']);
  }
}
