import { requireBakongConfig } from "./config";
import { getBakongAccessToken, renewBakongToken } from "./token";

function isUnauthorized(response, data) {
  return response.status === 401 || data?.errorCode === 6;
}

export class BakongApiError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "BakongApiError";
    Object.assign(this, details);
  }
}

export async function bakongRequest(path, { body, auth = false, retryUnauthorized = true } = {}) {
  const config = requireBakongConfig();
  const headers = {
    "Content-Type": "application/json",
  };

  if (auth) {
    const token = getBakongAccessToken();
    if (!token) {
      throw new BakongApiError("Bakong access token is not configured.", {
        code: "BAKONG_TOKEN_MISSING",
      });
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body || {}),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (auth && retryUnauthorized && isUnauthorized(response, data)) {
    await renewBakongToken();
    return bakongRequest(path, { body, auth, retryUnauthorized: false });
  }

  if (!response.ok) {
    throw new BakongApiError(data?.responseMessage || "Bakong request failed.", {
      code: "BAKONG_HTTP_ERROR",
      status: response.status,
      errorCode: data?.errorCode,
      responseCode: data?.responseCode,
    });
  }

  return data;
}
