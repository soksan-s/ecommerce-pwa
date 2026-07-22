export function normalizePhoneNumber(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^+0-9]/g, "");

  if (!normalized) return "";

  const digits = normalized.replace(/^\+/, "");
  if (!digits) return "";

  return `+${digits}`;
}

export function phonesMatch(first, second) {
  const normalizedFirst = normalizePhoneNumber(first);
  const normalizedSecond = normalizePhoneNumber(second);

  return Boolean(normalizedFirst && normalizedFirst === normalizedSecond);
}

export function phoneAuthEmail(phoneNumber) {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return "";

  return `phone-${normalized.replace(/\D/g, "")}@phone.local`;
}
