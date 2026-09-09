"use client";

import { useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { firebaseAuth, getFirebaseIdToken } from "@/lib/firebase";
import { phoneAuthEmail } from "@/lib/phone";

export default function TestPhoneLoginPage() {
  const [phoneNumber, setPhoneNumber] = useState("+85592499726");
  const [password, setPassword] = useState("TempPass1234");
  const [code, setCode] = useState("");
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const confirmationResultRef = useRef(null);
  const recaptchaVerifierRef = useRef(null);

  const pushLog = (message) => setLog((current) => [...current, message]);

  async function sendFirebaseOtp() {
    setBusy(true);
    setLog([]);
    try {
      const { RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");
      recaptchaVerifierRef.current?.clear();
      const verifier = new RecaptchaVerifier(firebaseAuth, "recaptcha-test-phone", {
        size: "invisible",
        callback: () => {},
      });
      recaptchaVerifierRef.current = verifier;
      confirmationResultRef.current = await signInWithPhoneNumber(firebaseAuth, phoneNumber, verifier);
      pushLog("Firebase OTP sent. Enter the Firebase test code.");
    } catch (error) {
      if (
        error?.code === "auth/captcha-check-failed" ||
        error?.message?.includes("captcha-check-failed") ||
        error?.message?.includes("Hostname match not found")
      ) {
        const host = typeof window !== "undefined" ? window.location.hostname : "your IP/domain";
        pushLog(`Firebase send failed: Domain "${host}" is not authorized. Add it in Firebase Console > Authentication > Settings > Authorized domains.`);
      } else {
        pushLog(`Firebase send failed: ${error?.message || String(error)}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function verifyFirebaseOtp() {
    setBusy(true);
    setLog([]);
    try {
      if (!confirmationResultRef.current) throw new Error("Send the Firebase OTP first.");
      const credential = await confirmationResultRef.current.confirm(code);
      await getFirebaseIdToken(credential);
      pushLog("Firebase OTP verified and ID token received.");
    } catch (error) {
      pushLog(`Firebase verification failed: ${error?.message || String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function createBetterAuthSession() {
    setBusy(true);
    setLog([]);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || "Local credentials rejected.");

      const { error } = await authClient.signIn.email({
        email: payload.emailForAuth || phoneAuthEmail(phoneNumber),
        password,
      });
      if (error) throw new Error(error.message || "Better Auth session creation failed.");
      pushLog("Better Auth session created.");
    } catch (error) {
      pushLog(`Session sign-in failed: ${error?.message || String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-5 p-6">
      <h1 className="text-2xl font-bold">Firebase Phone Login Test</h1>
      <p className="text-sm text-slate-600">Firebase verifies the phone OTP. Better Auth creates the application session.</p>
      <div id="recaptcha-test-phone" />
      <label className="block">Phone number<input className="mt-1 w-full border p-2" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} /></label>
      <label className="block">Password<input className="mt-1 w-full border p-2" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <label className="block">Firebase OTP<input className="mt-1 w-full border p-2" value={code} onChange={(event) => setCode(event.target.value)} placeholder="666777" /></label>
      <div className="flex flex-wrap gap-2">
        <button className="rounded bg-teal-700 px-3 py-2 text-white" onClick={sendFirebaseOtp} disabled={busy}>Send Firebase OTP</button>
        <button className="rounded bg-teal-700 px-3 py-2 text-white" onClick={verifyFirebaseOtp} disabled={busy || !code}>Verify Firebase OTP</button>
        <button className="rounded bg-teal-700 px-3 py-2 text-white" onClick={createBetterAuthSession} disabled={busy}>Create Better Auth Session</button>
      </div>
      <pre className="min-h-32 whitespace-pre-wrap rounded bg-slate-950 p-3 text-sm text-slate-100">{log.length ? log.join("\n") : "(no logs yet)"}</pre>
    </main>
  );
}
