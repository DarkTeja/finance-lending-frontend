import { Component, OnInit } from '@angular/core';
import { PushNotifications, Token, ActionPerformed } from '@capacitor/push-notifications';
import { Platform } from '@ionic/angular';
import { ApiService } from './services/api.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  constructor(
    private platform: Platform,
    private apiService: ApiService,
    private authService: AuthService
  ) {
    this.platform.ready().then(() => {
      this.setupPushNotifications();
    });
  }

  ngOnInit() {}

  setupPushNotifications() {
    if (!this.platform.is('capacitor')) {
      return;
    }

    // Only set up if logged in
    if (!this.authService.isLoggedIn()) {
      return;
    }

    PushNotifications.requestPermissions().then((result) => {
      if (result.receive === 'granted') {
        PushNotifications.register();
      }
    });

    PushNotifications.addListener('registration', (token: Token) => {
      console.log('Push registration success, token: ' + token.value);
      this.apiService.registerPushToken(token.value).subscribe({
        next: () => console.log('Token successfully sent to backend'),
        error: (err: any) => console.error('Failed to send token to backend', err)
      });
    });

    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Error on registration: ' + JSON.stringify(error));
    });

    PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
      console.log('Push received: ' + JSON.stringify(notification));
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
      console.log('Push action performed: ' + JSON.stringify(notification));
    });

    // Create the custom channel with the sound file provided by the user
    PushNotifications.createChannel({
      id: 'loan_cleared_channel_v3',
      name: 'Loan Cleared Notifications',
      description: 'Alerts when a loan is fully cleared by an employee',
      importance: 5, // Importance.HIGH
      visibility: 1, // Visibility.PUBLIC
      sound: 'my_sound', // my_sound.mp3 without extension
      vibration: true
    }).then(() => {
      console.log('Custom Push Notification Channel created successfully');
    }).catch((err) => {
      console.error('Error creating custom channel', err);
    });
  }
}
