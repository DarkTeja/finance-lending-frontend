import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // Use host PC local network IP so mobile browser can connect
  private readonly baseUrl = 'http://192.168.1.40:3000';

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

  changeMyPassword(data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/auth/me/password`, data, { headers: this.getHeaders() });
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

  // --- Customers ---
  getCustomers(): Observable<any> {
    return this.http.get(`${this.baseUrl}/customers`, { headers: this.getHeaders() });
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

  // --- Superadmin: Admins ---
  getAdmins(): Observable<any> {
    return this.http.get(`${this.baseUrl}/users/admins`, { headers: this.getHeaders() });
  }

  createAdmin(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/users/admins`, data, { headers: this.getHeaders() });
  }

  // --- Loans ---
  getLoans(): Observable<any> {
    return this.http.get(`${this.baseUrl}/loans`, { headers: this.getHeaders() });
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
  getCollections(): Observable<any> {
    return this.http.get(`${this.baseUrl}/collections`, { headers: this.getHeaders() });
  }

  createCollection(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/collections`, data, { headers: this.getHeaders() });
  }

  updateCollection(uuid: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/collections/${uuid}`, data, { headers: this.getHeaders() });
  }

  getDashboardStats(): Observable<any> {
    return this.http.get(`${this.baseUrl}/dashboard/stats`, { headers: this.getHeaders() });
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
}
