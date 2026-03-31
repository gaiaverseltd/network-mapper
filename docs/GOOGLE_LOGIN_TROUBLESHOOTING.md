# Google sign-in troubleshooting

The app uses **redirect-based** Google sign-in (`signInWithRedirect` + `getRedirectResult`), not popup.

## Checklist

### 1. Firebase Console – Google provider

- **Authentication → Sign-in method**
- Enable **Google**
- Set **Project support email**
- Save

### 2. Authorized domains

- **Authentication → Settings → Authorized domains**
- For local dev: add **`localhost`** (no port)
- For production: add your app domain (e.g. `yourapp.web.app` or your custom domain)

If the domain is missing, you get `auth/unauthorized-domain` after returning from Google.

### 3. Environment variables

In `.env` (from `.env.example`), ensure all are set:

- `VITE_ApiKey`
- `VITE_AuthDomain` (e.g. `gv-network-mapper-dev.firebaseapp.com`)
- `VITE_ProjectId`
- `VITE_StorageBucket`
- `VITE_MessagingSenderId`
- `VITE_AppId`
- `VITE_MeasurementId`

Wrong or missing `VITE_AuthDomain` / `VITE_ProjectId` can break redirect.

### 4. Redirect flow in code

- **Login**: “Sign in with Google” calls `signInWithGoogleRedirect()` → browser goes to Google.
- **Return**: After the user signs in, Google redirects back to the **same URL** (e.g. `http://localhost:5173/login`).
- **Complete**: On that load, `UserDataProvider` runs `getRedirectResult(auth)` once (guarded so React Strict Mode doesn’t call it twice). That completes sign-in and `onAuthStateChanged` runs with the user.

If you see “Redirecting to Google…” but then nothing after returning, check the browser console for `[Auth] Google redirect error` and the error code.

## Common errors

| Code | Meaning | Fix |
|------|--------|-----|
| `auth/operation-not-allowed` | Google provider disabled | Enable Google in Authentication → Sign-in method |
| `auth/unauthorized-domain` | Current origin not allowed | Add domain in Authentication → Settings → Authorized domains |
| `auth/credential-already-in-use` | Email already used with another provider | Use that provider or link accounts in Firebase |
| (no error, but no user) | Redirect result not processed | Ensure `getRedirectResult()` runs on the page load after redirect (ref guard in `usercontext.jsx` avoids double-call in Strict Mode) |

## Testing

1. Open app at e.g. `http://localhost:5173/login`.
2. Click “Sign in with Google”.
3. You should be sent to Google, then back to the same URL.
4. Check console for `[Auth] Google redirect sign-in completed for <uid>` or `[Auth] Google redirect error`.
5. If enabled, you should be redirected to `/create-account` (no profile yet) or `/dashboard` (profile exists).
