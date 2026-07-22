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
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const firebaseAuth = getAuth(firebaseApp);


export async function getFirebaseIdToken(userCredential, forceRefresh = false) {
  const user = userCredential?.user;

  if (!user) {
    throw new Error("Firebase verification did not return an authenticated user.");
  }

  return user.getIdToken(forceRefresh);
}

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
