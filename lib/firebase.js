// Firebase Client SDK - used for Phone OTP authentication
// This runs in the browser only (never on the server)
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

function getRequiredPublicEnv(name) {
  const value = process.env[name];
  if (!value) {
    // Avoid printing secrets; only mention which variable is missing.
    throw new Error(
      `Firebase config error: missing required environment variable ${name}`,
    );
  }
  return value;
}

const firebaseConfig = {
  apiKey: getRequiredPublicEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: getRequiredPublicEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: getRequiredPublicEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: getRequiredPublicEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getRequiredPublicEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getRequiredPublicEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
};


// Prevent initializing Firebase more than once (Next.js hot reload safety)
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const firebaseAuth = getAuth(firebaseApp);
export default firebaseApp;
