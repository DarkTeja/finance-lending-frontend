import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { AutoLoginGuard } from './guards/auto-login.guard';

const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./pages/login/login.module').then(m => m.LoginPageModule),
    canActivate: [AutoLoginGuard]
  },
  {
    path: 'admin-dashboard',
    loadChildren: () => import('./pages/admin-dashboard/admin-dashboard.module').then(m => m.AdminDashboardPageModule),
    canActivate: [AuthGuard],
    data: { expectedRole: 'admin' }
  },
  {
    path: 'employee-dashboard',
    loadChildren: () => import('./pages/employee-dashboard/employee-dashboard.module').then(m => m.EmployeeDashboardPageModule),
    canActivate: [AuthGuard],
    data: { expectedRole: 'employee' }
  },
  {
    path: 'add-customer',
    loadChildren: () => import('./pages/add-customer/add-customer.module').then(m => m.AddCustomerPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'superadmin-dashboard',
    loadChildren: () => import('./pages/superadmin-dashboard/superadmin-dashboard.module').then(m => m.SuperadminDashboardPageModule),
    canActivate: [AuthGuard],
    data: { expectedRole: 'superadmin' }
  },
  {
    path: 'reset-password',
    loadChildren: () => import('./pages/reset-password/reset-password.module').then(m => m.ResetPasswordPageModule)
  },
  {
    path: 'forgot-password',
    loadChildren: () => import('./pages/forgot-password/forgot-password.module').then(m => m.ForgotPasswordPageModule)
  },
  {
    path: '**',
    redirectTo: 'login',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
