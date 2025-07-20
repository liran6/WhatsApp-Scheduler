import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.91eaf32abdb64f29849826f8579a863f',
  appName: 'message-moment-magic',
  webDir: 'dist',
  server: {
    url: 'https://91eaf32a-bdb6-4f29-8498-26f8579a863f.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;