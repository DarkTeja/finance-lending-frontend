import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private onlineStatus = new BehaviorSubject<boolean>(true);
  public isOnline$ = this.onlineStatus.asObservable();

  constructor() {}

  async checkActualConnection(): Promise<boolean> {
    return true;
  }
}
