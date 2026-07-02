const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

module.exports = ({ config }) => {
  return {
    ...config,
    name: 'FE-Reports',
    slug: 'FireReport-v3',
    owner: 'cristo1327',
    version: '1.6.4',
    orientation: 'portrait',
    icon: './assets/images/logofe-report1-padded.png',
    scheme: 'firereport',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      bundleIdentifier: 'com.cristo2713.firereportv3',
      supportsTablet: true,
      infoPlist: {
        UIBackgroundModes: ['fetch'],
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: 'FireReport necesita acceso a la cámara para capturar evidencia fotográfica de las inspecciones de sistemas contra incendio.',
        NSPhotoLibraryUsageDescription: 'FireReport necesita acceso a tu galería para adjuntar fotos de evidencia de inspecciones previas.',
        NSPhotoLibraryAddUsageDescription: 'Guardar fotos de reportes en la galeria como respaldo.'
      }
    },
    android: {
      permissions: ['RECEIVE_BOOT_COMPLETED', 'READ_MEDIA_IMAGES', 'WRITE_EXTERNAL_STORAGE'],
      adaptiveIcon: {
        backgroundColor: '#d32f2f',
        foregroundImage: './assets/images/logofe-report1-padded.png'
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: 'com.cristo2713.FireReportv3'
    },
    web: {
      output: 'static',
      favicon: './assets/images/logofe-report1-padded.png'
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/logofe-report1-padded.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000'
          }
        }
      ],
      './withLocalSigning.js'
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true
    },
    extra: {
      router: {},
      eas: {
        projectId: '7ce18a44-752a-4fbe-b2b3-e6f7d15e26c7'
      },
      SUPABASE_URL: process.env.SUPABASE_URL || '',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
      EXCEL_PDF_API_URL: process.env.EXCEL_PDF_API_URL || ''
    }
  };
};
