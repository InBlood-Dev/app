import { ExpoConfig, ConfigContext } from "expo/config";

// Load environment variables based on APP_VARIANT or default to development
const ENV = process.env.APP_VARIANT || "development";

let envVars: Record<string, string> = {};

// Dynamically load the appropriate .env file
try {
  if (ENV === "production") {
    envVars =
      require("dotenv").config({ path: ".env.production" }).parsed || {};
  } else if (ENV === "staging") {
    envVars = require("dotenv").config({ path: ".env.staging" }).parsed || {};
  } else {
    envVars =
      require("dotenv").config({ path: ".env.development" }).parsed || {};
  }
  console.log(`[Config] Loaded ${ENV} environment variables`);
} catch (error) {
  console.warn(
    `[Config] Failed to load ${ENV} environment file, using defaults`,
  );
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "InBlood",
  slug: "inblood",
  version: "2.5",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0B0B0B",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.inblood.app",
    config: {
      googleMapsApiKey: "AIzaSyB6qyKSRUDCdU6Nl88Kg59JdvBr4nDrhJg",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0B0B0B",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: "com.inblood.app",
    googleServicesFile: "./google-services.json",
    config: {
      googleMaps: {
        apiKey: "AIzaSyB6qyKSRUDCdU6Nl88Kg59JdvBr4nDrhJg",
      },
    },
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  scheme: "inblood",
  plugins: [
    "@react-native-firebase/app",
    "expo-image-picker",
    "expo-font",
    "expo-notifications",
    [
      "@react-native-google-signin/google-signin",
      {
        iosUrlScheme:
          "com.googleusercontent.apps.345043990448-d7t4lhjte5tqfh7249ovia2b6pbn0k90",
      },
    ],
    [
      "react-native-maps",
      {
        enableGoogleMapsOnAndroid: true,
        enableGoogleMapsOnIOS: true,
        androidGoogleMapsApiKey: "AIzaSyB6qyKSRUDCdU6Nl88Kg59JdvBr4nDrhJg",
        iOSGoogleMapsApiKey: "AIzaSyB6qyKSRUDCdU6Nl88Kg59JdvBr4nDrhJg",
      },
    ],
  ],
  extra: {
    // Environment variables exposed to the app via Constants.expoConfig.extra
    env: ENV,
    apiBaseUrl:
      envVars.API_BASE_URL || "https://backend-cfh1.onrender.com/api/v1",
    // apiBaseUrl: envVars.API_BASE_URL || 'https://backend-cfh1.onrender.com/api/v1',
    apiTimeout: parseInt(envVars.API_TIMEOUT || "30000", 10),
    firebase: {
      apiKey: envVars.FIREBASE_API_KEY,
      authDomain: envVars.FIREBASE_AUTH_DOMAIN,
      databaseURL: envVars.FIREBASE_DATABASE_URL,
      projectId: envVars.FIREBASE_PROJECT_ID,
      storageBucket: envVars.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: envVars.FIREBASE_MESSAGING_SENDER_ID,
      appId: envVars.FIREBASE_APP_ID,
      measurementId: envVars.FIREBASE_MEASUREMENT_ID,
    },
    googleWebClientId: envVars.GOOGLE_WEB_CLIENT_ID,
    eas: {
      projectId: "6c1d819c-6aa8-4c1e-ac83-4e44079c10e5",
    },
  },
});
