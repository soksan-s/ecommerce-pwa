import { getBakongConfig } from "./config";

let runtimeAccessToken = null;

export function getBakongAccessToken() {
  return runtimeAccessToken || getBakongConfig().accessToken;
}

export function setBakongAccessToken(token) {
  runtimeAccessToken = token || null;
}

export async function renewBakongToken() {
  const config = getBakongConfig();

  if (!config.baseUrl || !config.email) {
    throw Object.assign(new Error("Bakong token renewal is not configured."), {
      code: "BAKONG_RENEW_CONFIG_MISSING",
    });
  }

  const response = await fetch(`${config.baseUrl}/v1/renew_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: config.email }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.responseCode !== 0 || !data?.data?.token) {
    throw Object.assign(new Error(data?.responseMessage || "Unable to renew Bakong token."), {
      code: "BAKONG_RENEW_FAILED",
      status: response.status,
      errorCode: data?.errorCode,
      responseCode: data?.responseCode,
    });
  }

  setBakongAccessToken(data.data.token);
  return data.data.token;
}
