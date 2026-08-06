import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { SuperadminDashboardPage } from './superadmin-dashboard.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    SuperadminDashboardPage,
    RouterModule.forChild([
      {
        path: '',
        component: SuperadminDashboardPage
      }
    ])
  ]
})
export class SuperadminDashboardPageModule {}
