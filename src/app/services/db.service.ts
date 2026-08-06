import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';

export interface Customer {
  uuid: string;
  name: string;
  mobile_number: string;
  place: string;
  father_name?: string;
  aadhaar_number?: string;
  pan_number?: string;
  address?: string;
  occupation?: string;
  guarantor_name?: string;
  guarantor_mobile?: string;
  notes?: string;
  assigned_employee_uuid?: string;
  organization_uuid?: string;
  collection_days?: string;
  sync_status: 'Pending' | 'Synced' | 'Failed';
}

export interface Collection {
  uuid: string;
  loan_uuid: string;
  collected_amount: number;
  collected_by_user_uuid?: string;
  organization_uuid?: string;
  receipt_no?: string;
  collection_date?: string;
  sync_status: 'Pending' | 'Synced' | 'Failed';
  
  // For frontend display
  customer_name?: string;
  accno?: string;
}

export interface SyncQueueItem {
  id?: number;
  table_name: 'customers' | 'collections';
  record_uuid: string;
  action: 'INSERT' | 'UPDATE';
  payload: string; // JSON stringified data
  attempts: number;
  last_error?: string;
  created_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DbService {
  private readonly CUSTOMERS_KEY = 'money_lending_customers';
  private readonly COLLECTIONS_KEY = 'money_lending_collections';
  private readonly SYNC_QUEUE_KEY = 'money_lending_sync_queue';

  constructor() {
    this.initDb();
  }

  initDb() {
    if (!localStorage.getItem(this.CUSTOMERS_KEY)) {
      localStorage.setItem(this.CUSTOMERS_KEY, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.COLLECTIONS_KEY)) {
      localStorage.setItem(this.COLLECTIONS_KEY, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.SYNC_QUEUE_KEY)) {
      localStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify([]));
    }
  }

  // --- Customers CRUD ---
  async getCustomers(): Promise<Customer[]> {
    const data = localStorage.getItem(this.CUSTOMERS_KEY);
    return data ? JSON.parse(data) : [];
  }

  async getCustomerByUuid(uuid: string): Promise<Customer | undefined> {
    const list = await this.getCustomers();
    return list.find(c => c.uuid === uuid);
  }

  async saveCustomer(customer: Customer): Promise<void> {
    const list = await this.getCustomers();
    const idx = list.findIndex(c => c.uuid === customer.uuid);
    if (idx > -1) {
      list[idx] = customer;
    } else {
      list.push(customer);
    }
    localStorage.setItem(this.CUSTOMERS_KEY, JSON.stringify(list));
  }

  async setCustomers(customers: Customer[]): Promise<void> {
    localStorage.setItem(this.CUSTOMERS_KEY, JSON.stringify(customers));
  }

  async deleteCustomer(uuid: string): Promise<void> {
    const list = await this.getCustomers();
    const filtered = list.filter(c => c.uuid !== uuid);
    localStorage.setItem(this.CUSTOMERS_KEY, JSON.stringify(filtered));
  }

  // --- Collections CRUD ---
  async getCollections(): Promise<Collection[]> {
    const data = localStorage.getItem(this.COLLECTIONS_KEY);
    return data ? JSON.parse(data) : [];
  }

  async setCollections(collections: Collection[]): Promise<void> {
    localStorage.setItem(this.COLLECTIONS_KEY, JSON.stringify(collections));
  }

  async saveCollection(collection: Collection): Promise<void> {
    const list = await this.getCollections();
    const idx = list.findIndex(c => c.uuid === collection.uuid);
    if (idx > -1) {
      list[idx] = collection;
    } else {
      list.push(collection);
    }
    localStorage.setItem(this.COLLECTIONS_KEY, JSON.stringify(list));
  }

  // --- Sync Queue CRUD ---
  async getSyncQueue(): Promise<SyncQueueItem[]> {
    const data = localStorage.getItem(this.SYNC_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  }

  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'attempts' | 'created_at'>): Promise<void> {
    const list = await this.getSyncQueue();
    const newItem: SyncQueueItem = {
      ...item,
      id: list.length > 0 ? (list[list.length - 1].id || 0) + 1 : 1,
      attempts: 0,
      created_at: new Date().toISOString()
    };
    list.push(newItem);
    localStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(list));
  }

  async removeFromSyncQueue(id: number): Promise<void> {
    const list = await this.getSyncQueue();
    const filtered = list.filter(item => item.id !== id);
    localStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(filtered));
  }

  async updateSyncQueueItem(updatedItem: SyncQueueItem): Promise<void> {
    const list = await this.getSyncQueue();
    const idx = list.findIndex(item => item.id === updatedItem.id);
    if (idx > -1) {
      list[idx] = updatedItem;
      localStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(list));
    }
  }

  async clearAll() {
    localStorage.removeItem(this.CUSTOMERS_KEY);
    localStorage.removeItem(this.COLLECTIONS_KEY);
    localStorage.removeItem(this.SYNC_QUEUE_KEY);
    this.initDb();
  }
}
