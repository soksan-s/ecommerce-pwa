import { auth } from "@/lib/auth";

export async function GET() {
  // This endpoint is only for debugging what Better Auth exposes at runtime.
  // It should be removed after you finish wiring phone registration.

  const api = auth?.api || {};

  // Attempt to find anything phone/otp/credential related.
  const keys = Object.keys(api);
  const phoneLike = keys.filter((k) => /phone|otp|signIn|signUp|credential|pass(password)?|verify/i.test(k));

  // Additionally, return a list of all function-valued keys.
  const functions = keys
    .filter((k) => typeof api[k] === "function")
    .map((k) => ({ key: k, arity: api[k].length }));

  return new Response(
    JSON.stringify({
      keysCount: keys.length,
      phoneLikeKeys: phoneLike,
      functionKeys: functions,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}
