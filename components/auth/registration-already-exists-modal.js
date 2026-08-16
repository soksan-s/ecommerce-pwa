"use client";

export function RegistrationAlreadyExistsModal({
  open,
  phoneNumber,
  onClose,
  onSignIn,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg">
        <div className="text-lg font-bold">Account already exists</div>
        <div className="mt-2 text-sm text-[var(--foreground)]">
          An account with this phone number already exists. Please sign in or use a different phone number.
          {phoneNumber ? (
            <div className="mt-2 text-xs font-semibold text-[var(--muted-foreground)]">{phoneNumber}</div>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onSignIn}
            className="rounded-xl border border-[var(--border-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--foreground)] hover:bg-[var(--surface-soft)]"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
          >
            Use another number
          </button>
        </div>
      </div>
    </div>
  );
}

