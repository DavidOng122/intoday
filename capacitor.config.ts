import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.memotask.app',
  appName: 'MemoTask',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
    },
  },
};

export default config;
