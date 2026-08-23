import type { CapacitorConfig } from '@capacitor/cli';

const target = process.env.CAPACITOR_APP_TARGET === 'staff' ? 'staff' : 'customer';

const config: CapacitorConfig = {
  appId: target === 'staff' ? 'com.nowaitsalon.staff' : 'com.nowaitsalon.customer',
  appName: target === 'staff' ? 'No-Wait Salon Staff' : 'No-Wait Salon',
  webDir: 'dist',
  android: {
    path: target === 'staff' ? 'android-staff' : 'android-customer',
    allowMixedContent: process.env.VITE_API_BASE_URL?.startsWith('http://') || false,
  },
};

export default config;
