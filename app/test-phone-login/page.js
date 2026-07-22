"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export default function TestPhoneLoginPage() {
  const [phoneNumber, setPhoneNumber] = useState("+85599909596");
  const [password, setPassword] = useState("TempPass1234");
  const [code, setCode] = useState("");
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);

  const pushLog = (line) => setLog((prev) => [...prev, line]);

  const disabled = busy || !phoneNumber.trim() || !password.trim();

  async function handleSendOTP() {
    setBusy(true);
    setLog([]);
    try {
      pushLog(`Sending OTP for ${phoneNumber} ...`);
      const { error } = await authClient.phoneNumber.sendOtp({ phoneNumber });
      if (error) {
        pushLog(`sendOtp error: ${error?.message || String(error)}`);
        return;
      }
      pushLog("OTP sent. Check Next.js server terminal for the OTP code (lib/auth.js sendOTP logs it).");
      pushLog("Enter the OTP code below, then click Verify OTP.");
    } catch (e) {
      pushLog(`sendOtp failed: ${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOTP() {
    setBusy(true);
    setLog([]);
    try {
      pushLog(`Verifying OTP for ${phoneNumber} ...`);
      const { error } = await authClient.phoneNumber.verify({ phoneNumber, code });
      if (error) {
        pushLog(`verify error: ${error?.message || String(error)}`);
        return;
      }
      pushLog("OTP verified.");
      pushLog("Now sign in using phoneNumber + password.");
    } catch (e) {
      pushLog(`verify failed: ${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignIn() {
    setBusy(true);
    setLog([]);
    try {
      pushLog(`Signing in for ${phoneNumber} ...`);
      const { error } = await authClient.signIn.phoneNumber({ phoneNumber, password });
      if (error) {
        pushLog(`signIn.phoneNumber error: ${error?.message || String(error)}`);
        return;
      }
      pushLog("signIn.phoneNumber success.");
      pushLog("Redirect/login payload received.");
      pushLog("Now run: node scripts/debug-better-auth.js <digits> to inspect created prisma.account rows.");
    } catch (e) {
      pushLog(`signIn.phoneNumber failed: ${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>Test Better Auth Phone Flow</h1>
      <p style={{ marginTop: 8, color: "#555" }}>
        This is temporary. Your Better Auth phone plugin prints the OTP code to the Next.js server terminal.
      </p>

      <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
        <label>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Phone number</div>
          <input
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />
        </label>

        <label>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Password</div>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />
        </label>

        <label>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>OTP code (from server terminal)</div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />
        </label>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={handleSendOTP} disabled={disabled}>
            Send OTP (Better Auth)
          </button>
          <button onClick={handleVerifyOTP} disabled={busy || !code.trim()}>
            Verify OTP (Better Auth)
          </button>
          <button onClick={handleSignIn} disabled={disabled || !code.trim()}>
            Sign in (phone + password)
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Log</div>
          <pre style={{ background: "#0b1020", color: "#d7e2ff", padding: 12, borderRadius: 12, minHeight: 120, whiteSpace: "pre-wrap" }}>
            {log.length ? log.join("\n") : "(no logs yet)"}
          </pre>
        </div>
      </div>
    </div>
  );
}
