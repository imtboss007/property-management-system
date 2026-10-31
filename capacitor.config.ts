import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.axivestra.mobile2026',
  appName: 'AXIVESTRA',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: { CapacitorHttp: { enabled: true } },
  server: { androidScheme: 'https' }
};

export default config;
