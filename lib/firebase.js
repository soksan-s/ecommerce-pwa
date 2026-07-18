// Firebase Client SDK - used for Phone OTP authentication
// This runs in the browser only (never on the server)
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

let didLogMissing = false;

function getOptionalPublicEnv(name) {
  const value = process.env[name];
  if (!value && !didLogMissing) {
    // Avoid printing secrets; only mention which variable is missing.
    // Also only log once to reduce noise.
    console.error("Firebase config error (missing):", {
      NEXT_PUBLIC_FIREBASE_API_KEY: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      NEXT_PUBLIC_FIREBASE_APP_ID: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
    didLogMissing = true;
  }
  return value || "";
}

// Import the functions you need from the SDKs you need

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAtWNmynHIqTCxEAI0H8fp7ltdPTumlPRE",
  authDomain: "otp-ecomerce.firebaseapp.com",
  projectId: "otp-ecomerce",
  storageBucket: "otp-ecomerce.firebasestorage.app",
  messagingSenderId: "283778593311",
  appId: "1:283778593311:web:6361fad7ba8bc766935b2a",
  measurementId: "G-SY1Y9GC6T4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

  
// Prevent initializing Firebase more than once (Next.js hot reload safety)
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const firebaseAuth = getAuth(firebaseApp);
export default firebaseApp;
