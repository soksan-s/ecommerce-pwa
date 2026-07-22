import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

let firebaseAnalyticsPromise;
let didLogMissingConfig = false;

function getPublicEnv(name) {
  const value = process.env[name];

  if (!value && !didLogMissingConfig) {
    console.error("Firebase config is missing one or more NEXT_PUBLIC_FIREBASE_* values.");
    didLogMissingConfig = true;
  }

  return value || "";
}

const firebaseConfig = {
  apiKey: getPublicEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: getPublicEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: getPublicEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: getPublicEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getPublicEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getPublicEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const firebaseAuth = getAuth(firebaseApp);

export function getFirebaseAnalytics() {
  if (typeof window === "undefined") return null;

  firebaseAnalyticsPromise ||= import("firebase/analytics").then(
    async ({ getAnalytics, isSupported }) => {
      if (!(await isSupported())) return null;
      return getAnalytics(firebaseApp);
    },
  );

  return firebaseAnalyticsPromise;
}

export default firebaseApp;
