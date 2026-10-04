import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tripcheck.app',
  appName: 'TripInsight',
  webDir: 'dist-mobile',
  server: {
    hostname: 'localhost',
    iosScheme: 'https',
  },
  ios: {
    backgroundColor: '#fbfdfc',
    contentInset: 'never',
    preferredContentMode: 'mobile',
    scrollEnabled: true,
  },
};

export default config;
