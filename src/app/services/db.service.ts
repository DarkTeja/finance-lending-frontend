import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DbService {

  constructor() {}

  async setCustomers(customers: any[]): Promise<void> {}
  async getCustomers(): Promise<any[]> { return []; }
  
  async saveCustomer(customer: any): Promise<void> {}

  async setCollections(collections: any[]): Promise<void> {}
  async getCollections(): Promise<any[]> { return []; }

  async saveCollection(collection: any): Promise<void> {}

  async addToSyncQueue(item: any): Promise<void> {}
}
