import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.darkteja.financelendingapp',
  appName: 'Finance Lending',
  webDir: 'www',
  bundledWebRuntime: false,
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  },
  server: {
    cleartext: true,
    androidScheme: 'http'
  }
};

export default config;
