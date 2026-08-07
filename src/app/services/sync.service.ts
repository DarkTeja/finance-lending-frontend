import { Injectable } from '@angular/core';
import { DbService, SyncQueueItem, Customer } from './db.service';
import { ApiService } from './api.service';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private isOnlineSubject = new BehaviorSubject<boolean>(true);
  public isOnline$ = this.isOnlineSubject.asObservable();
  
  private isSyncingSubject = new BehaviorSubject<boolean>(false);
  public isSyncing$ = this.isSyncingSubject.asObservable();

  constructor(
    private dbService: DbService,
    private apiService: ApiService
  ) {
    this.initNetworkListener();
    // Auto-sync check every 30 seconds
    setInterval(() => {
      if (this.isOnlineSubject.value && !this.isSyncingSubject.value) {
        this.syncQueue();
      }
    }, 30000);
  }

  private initNetworkListener() {
    this.isOnlineSubject.next(navigator.onLine);

    window.addEventListener('online', () => {
      console.log('Network online. Triggering synchronization...');
      this.isOnlineSubject.next(true);
      this.syncQueue();
    });

    window.addEventListener('offline', () => {
      console.log('Network offline. Pausing sync queue.');
      this.isOnlineSubject.next(false);
    });
  }

  async checkActualConnection(): Promise<boolean> {
    try {
      const response = await fetch('http://192.168.1.40:3000/health');
      const online = response.ok;
      this.isOnlineSubject.next(online);
      return online;
    } catch (err) {
      this.isOnlineSubject.next(false);
      return false;
    }
  }

  async syncQueue() {
    if (this.isSyncingSubject.value || !this.isOnlineSubject.value) {
      return;
    }

    this.isSyncingSubject.next(true);
    console.log('Starting sync queue processing...');

    try {
      const queue = await this.dbService.getSyncQueue();
      if (queue.length === 0) {
        console.log('Sync queue is empty.');
        this.isSyncingSubject.next(false);
        return;
      }

      for (const item of queue) {
        let success = false;
        try {
          success = await this.processSyncItem(item);
        } catch (err: any) {
          console.error(`Sync failed for item ${item.id}:`, err);
          item.attempts += 1;
          item.last_error = err?.message || 'Unknown network error';
          await this.dbService.updateSyncQueueItem(item);
          break; // Halt execution to avoid ordering errors
        }

        if (success) {
          await this.dbService.removeFromSyncQueue(item.id!);
        } else {
          break;
        }
      }
    } catch (err) {
      console.error('Error during queue processing:', err);
    } finally {
      this.isSyncingSubject.next(false);
      console.log('Finished sync queue processing.');
    }
  }

  private async processSyncItem(item: SyncQueueItem): Promise<boolean> {
    const payload = JSON.parse(item.payload);

    switch (item.table_name) {
      case 'customers':
        return await this.syncCustomer(item.record_uuid, payload);
      case 'collections':
        return await this.syncCollection(item.record_uuid, payload);
      default:
        console.warn(`Unknown table in sync queue: ${item.table_name}`);
        return true;
    }
  }

  private async syncCustomer(uuid: string, payload: any): Promise<boolean> {
    console.log(`Syncing customer ${uuid}...`);
    return new Promise((resolve, reject) => {
      this.apiService.createCustomer(payload).subscribe({
        next: async (res) => {
          const customer = await this.dbService.getCustomerByUuid(uuid);
          if (customer) {
            customer.sync_status = 'Synced';
            await this.dbService.saveCustomer(customer);
          }
          resolve(true);
        },
        error: (err) => {
          if (err.status === 400 || err.status === 409) {
            resolve(true); // Clear invalid items
          } else {
            reject(err);
          }
        }
      });
    });
  }

  private async syncCollection(uuid: string, payload: any): Promise<boolean> {
    console.log(`Syncing collection ${uuid}...`);
    return new Promise((resolve, reject) => {
      this.apiService.createCollection(payload).subscribe({
        next: async (res) => {
          const collections = await this.dbService.getCollections();
          const collection = collections.find(c => c.uuid === uuid);
          if (collection) {
            collection.sync_status = 'Synced';
            await this.dbService.saveCollection(collection);
          }
          resolve(true);
        },
        error: (err) => {
          if (err.status === 400 || err.status === 409) {
            resolve(true); // Clear invalid items
          } else {
            reject(err);
          }
        }
      });
    });
  }
}
