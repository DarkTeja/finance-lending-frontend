import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // Use host PC local network IP so mobile browser can connect
  private readonly baseUrl = 'http://3.110.218.28';
  // private readonly baseUrl = 'http://192.168.1.45:3000';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  // --- Auth ---
  login(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/login`, data);
  }

  getAuthMe(): Observable<any> {
    return this.http.get(`${this.baseUrl}/auth/me`, { headers: this.getHeaders() });
  }

  getLoginHistory(): Observable<any> {
    return this.http.get(`${this.baseUrl}/auth/login-history`, { headers: this.getHeaders() });
  }

  changeMyPassword(data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/auth/me/password`, data, { headers: this.getHeaders() });
  }

  forgotPassword(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/forgot-password`, data);
  }

  resetPassword(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/reset-password`, data);
  }

  // --- Notifications ---
  registerPushToken(token: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/notifications/token`, { token }, { headers: this.getHeaders() });
  }

  unregisterPushToken(): Observable<any> {
    return this.http.delete(`${this.baseUrl}/notifications/token`, { headers: this.getHeaders() });
  }

  // --- Employees ---
  getEmployees(): Observable<any> {
    return this.http.get(`${this.baseUrl}/users/employees`, { headers: this.getHeaders() });
  }

  createEmployee(employee: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/users/employees`, employee, { headers: this.getHeaders() });
  }

  toggleEmployeeStatus(uuid: string, status: 'active' | 'disabled'): Observable<any> {
    return this.http.put(`${this.baseUrl}/users/employees/${uuid}/status`, { status }, { headers: this.getHeaders() });
  }

  resetEmployeePassword(uuid: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/users/employees/${uuid}/reset-password`, data, { headers: this.getHeaders() });
  }

  updateEmployeePermissions(uuid: string, permissions: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/users/employees/${uuid}/permissions`, permissions, { headers: this.getHeaders() });
  }

  updateEmployee(uuid: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/users/employees/${uuid}`, data, { headers: this.getHeaders() });
  }

  // --- Customers ---
  getCustomers(limit: number = 10000, offset: number = 0): Observable<any> {
    return this.http.get(`${this.baseUrl}/customers?limit=${limit}&offset=${offset}`, { headers: this.getHeaders() });
  }

  createCustomer(customer: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/customers`, customer, { headers: this.getHeaders() });
  }

  updateCustomer(uuid: string, customer: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/customers/${uuid}`, customer, { headers: this.getHeaders() });
  }

  deleteCustomer(uuid: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/customers/${uuid}`, { headers: this.getHeaders() });
  }

  // --- Superadmin: Organizations ---
  getOrganizations(): Observable<any> {
    return this.http.get(`${this.baseUrl}/organizations`, { headers: this.getHeaders() });
  }

  createOrganization(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/organizations`, data, { headers: this.getHeaders() });
  }

  updateOrganization(uuid: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/organizations/${uuid}`, data, { headers: this.getHeaders() });
  }

  // --- Superadmin: Admins ---
  getAdmins(): Observable<any> {
    return this.http.get(`${this.baseUrl}/users/admins`, { headers: this.getHeaders() });
  }

  createAdmin(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/users/admins`, data, { headers: this.getHeaders() });
  }

  updateAdmin(uuid: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/users/admins/${uuid}`, data, { headers: this.getHeaders() });
  }

  toggleAdminStatus(uuid: string, status: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/users/admins/${uuid}/status`, { status }, { headers: this.getHeaders() });
  }

  // --- Loans ---
  getLoans(limit: number = 10000, offset: number = 0): Observable<any> {
    return this.http.get(`${this.baseUrl}/loans?limit=${limit}&offset=${offset}`, { headers: this.getHeaders() });
  }

  createLoan(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/loans`, data, { headers: this.getHeaders() });
  }

  updateLoan(uuid: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/loans/${uuid}`, data, { headers: this.getHeaders() });
  }

  deleteLoan(uuid: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/loans/${uuid}`, { headers: this.getHeaders() });
  }

  // --- Collections ---
  getCollections(limit: number = 10000, offset: number = 0): Observable<any> {
    return this.http.get(`${this.baseUrl}/collections?limit=${limit}&offset=${offset}`, { headers: this.getHeaders() });
  }

  createCollection(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/collections`, data, { headers: this.getHeaders() });
  }

  updateCollection(uuid: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/collections/${uuid}`, data, { headers: this.getHeaders() });
  }

  getDashboardStats(range: string = 'all'): Observable<any> {
    return this.http.get(`${this.baseUrl}/dashboard/stats?range=${range}`, { headers: this.getHeaders() });
  }

  addExpense(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/expenses`, data, { headers: this.getHeaders() });
  }

  getExpensesToday(): Observable<any> {
    return this.http.get(`${this.baseUrl}/expenses/today`, { headers: this.getHeaders() });
  }

  getAllExpenses(): Observable<any> {
    return this.http.get(`${this.baseUrl}/expenses/all`, { headers: this.getHeaders() });
  }

  updateExpense(uuid: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/expenses/${uuid}`, data, { headers: this.getHeaders() });
  }

  deleteExpense(uuid: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/expenses/${uuid}`, { headers: this.getHeaders() });
  }

  // --- Investments ---
  getInvestments(): Observable<any> {
    return this.http.get(`${this.baseUrl}/investments`, { headers: this.getHeaders() });
  }

  addInvestment(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/investments`, data, { headers: this.getHeaders() });
  }

  updateInvestment(uuid: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/investments/${uuid}`, data, { headers: this.getHeaders() });
  }

  // --- Cash Book / Ledger ---
  getCashbook(date?: string): Observable<any> {
    let url = `${this.baseUrl}/dashboard/cashbook`;
    if (date) {
      url += `?date=${date}`;
    }
    return this.http.get(url, { headers: this.getHeaders() });
  }
  // --- Withdrawals ---
  getWithdrawals(): Observable<any> {
    return this.http.get(`${this.baseUrl}/withdrawals`, { headers: this.getHeaders() });
  }

  addWithdrawal(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/withdrawals`, data, { headers: this.getHeaders() });
  }

  deleteWithdrawal(uuid: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/withdrawals/${uuid}`, { headers: this.getHeaders() });
  }
}
