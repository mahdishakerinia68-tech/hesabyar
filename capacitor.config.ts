import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.hesabyar.app',
  appName: 'حساب‌یار',
  webDir: '.',
  bundledWebRuntime: false,
  plugins: {
    LocalNotifications: { smallIcon: 'ic_stat_icon_config_sample' }
  },
  ios: { contentInset: 'automatic' },
  android: { allowMixedContent: false }
};
export default config;
