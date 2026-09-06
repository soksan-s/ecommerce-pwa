const DEFAULT_EXPIRY_MINUTES = 10;

function cleanEnv(name) {
  return (process.env[name] || "").trim();
}

export function getBakongConfig() {
  const publicAppUrl =
    cleanEnv("PUBLIC_APP_URL") ||
    cleanEnv("SERVER_PUBLIC_URL") ||
    cleanEnv("BASE_URL") ||
    cleanEnv("BETTER_AUTH_URL") ||
    "http://localhost:3000";

  const expiryMinutes = Number(cleanEnv("BAKONG_PAYMENT_EXPIRY_MINUTES") || DEFAULT_EXPIRY_MINUTES);

  return {
    baseUrl: cleanEnv("BAKONG_BASE_URL").replace(/\/+$/, ""),
    email: cleanEnv("BAKONG_EMAIL"),
    accessToken: cleanEnv("BAKONG_ACCESS_TOKEN"),
    accountId: cleanEnv("BAKONG_ACCOUNT_ID"),
    merchantName: cleanEnv("BAKONG_MERCHANT_NAME") || "Soeum Savet",
    merchantCity: cleanEnv("BAKONG_MERCHANT_CITY") || "Phnom Penh",
    merchantCategoryCode: cleanEnv("BAKONG_MERCHANT_CATEGORY_CODE") || "5999",
    mobileNumber: cleanEnv("BAKONG_MERCHANT_PHONE"),
    publicAppUrl: publicAppUrl.replace(/\/+$/, ""),
    expiryMinutes: Number.isFinite(expiryMinutes) && expiryMinutes > 0 ? expiryMinutes : DEFAULT_EXPIRY_MINUTES,
  };
}

export function requireBakongConfig() {
  const config = getBakongConfig();
  const missing = [];

  if (!config.baseUrl) missing.push("BAKONG_BASE_URL");
  if (!config.accountId) missing.push("BAKONG_ACCOUNT_ID");

  if (missing.length) {
    throw Object.assign(new Error(`Missing Bakong configuration: ${missing.join(", ")}`), {
      code: "BAKONG_CONFIG_MISSING",
      missing,
    });
  }

  return config;
}

export function getBakongSourceInfo() {
  const config = getBakongConfig();

  return {
    appIconUrl: `${config.publicAppUrl}/icon.svg`,
    appName: "Soeum Savet",
    appDeepLinkCallback: `${config.publicAppUrl}/client?tab=orders`,
  };
}
