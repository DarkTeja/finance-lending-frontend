import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { AddCustomerPage } from './add-customer.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    AddCustomerPage,
    RouterModule.forChild([
      {
        path: '',
        component: AddCustomerPage
      }
    ])
  ]
})
export class AddCustomerPageModule {}
