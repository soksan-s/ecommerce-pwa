# Firebase env fix (Phone Auth)

## Current issue
Your runtime error indicates `process.env.NEXT_PUBLIC_FIREBASE_*` values are empty.

## Required keys in `./.env` (project root, same folder as package.json)
Set all of these (no quotes needed):

- NEXT_PUBLIC_FIREBASE_API_KEY=
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
- NEXT_PUBLIC_FIREBASE_PROJECT_ID=
- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
- NEXT_PUBLIC_FIREBASE_APP_ID=

## Where to get values
Firebase Console → Project settings → General

## After editing `.env`
1) Kill all running Next dev servers to avoid lock/port conflicts.
2) Start once:
   - `npm run dev`

## Expected result
Your auth UI should no longer throw:
- `Firebase config error: missing required environment variable NEXT_PUBLIC_FIREBASE_API_KEY`

Then retry: Create account → Send SMS.

