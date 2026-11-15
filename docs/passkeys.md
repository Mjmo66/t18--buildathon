# Passkeys

> The app is now a Vite web app: only the web client (`src/lib/auth/passkey/`) and the edge function apply. The native and `.well-known` sections below are kept for reference only.

Passkey (WebAuthn) sign-up and sign-in that ends in a normal Supabase session.

```
app ──► POST /functions/v1/passkey/<route> ──► edge function (service role)
         register/options → WebAuthn create → register/verify ─┐
         login/options    → WebAuthn get    → login/verify    ─┴► { token_hash, email }
app ──► supabase.auth.verifyOtp({ token_hash, type: 'email' }) ──► session
```

| Part | Path |
|---|---|
| Edge function | `supabase/functions/passkey/index.ts` (Supabase wiring), `handler.ts` (routes), `handler.test.ts` |
| Client | `lib/auth/passkey/` — `index.web.ts` (`@simplewebauthn/browser`), `index.native.ts` (`react-native-passkey`), `common.ts`, `index.ts` (types / unsupported fallback) |
| Hosting | `public/.well-known/apple-app-site-association`, `public/.well-known/assetlinks.json`, `public/_headers` |
| Tables | `passkey_credentials`, `passkey_challenges` (base migration, service role only) |

## Client API (`lib/auth/passkey`)

```ts
isPasskeySupported(): Promise<boolean>          // false in Expo Go and on insecure origins
signUpWithPasskey({ email, displayName, role }): Promise<void>   // creates the account + session
signInWithPasskey(email?): Promise<void>        // no email → discoverable (account picker)
addPasskeyToCurrentUser(): Promise<void>        // signed-in user adds a passkey
```

Errors are `PasskeyError` with a short `message` for the UI; `cancelled === true` when the user
dismissed the prompt (show nothing or a quiet hint). After success, `onAuthStateChange` fires as
with any sign-in. New accounts get their profile from the `handle_new_user` trigger
(`user_metadata.role`, `display_name`); the auth user id is also the WebAuthn user handle.

## Routes (POST, JSON)

| Route | Body | Returns |
|---|---|---|
| `/register/options` | `{ email, displayName, role }` for a new account; `{}` + `Authorization: Bearer <access token>` to add a passkey | `{ options, challengeId }` |
| `/register/verify` | `{ challengeId, response }` | `{ token_hash, email }` |
| `/login/options` | `{ email? }` | `{ options, challengeId }` |
| `/login/verify` | `{ challengeId, response }` | `{ token_hash, email }` |

Errors: `{ error: "<short message>" }`, status 400 (401 when adding a passkey without a session).
Challenges live 5 minutes, are single use (deleted when verified) and expired ones are purged on
each call. Registration requires a discoverable credential; user verification is preferred.

## Deploy

```sh
supabase link --project-ref <ref>
supabase secrets set \
  RP_ID=kindred.pages.dev,localhost \
  RP_NAME=Kindred \
  RP_ORIGINS=https://kindred.pages.dev,http://localhost:8081
supabase functions deploy passkey --no-verify-jwt
```

- `--no-verify-jwt` is required: sign-up and sign-in are anonymous calls. (There is no
  `supabase/config.toml` in the repo; if one is added, `[functions.passkey] verify_jwt = false`
  does the same.)
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase automatically.
- `RP_ID`: comma list. Each request uses the entry its `Origin` belongs to (`localhost` for
  `http://localhost:8081`, `kindred.pages.dev` for the site and its `*.kindred.pages.dev`
  previews if those origins are listed). Native apps send no `Origin`, so **the first entry is
  used for iOS / Android and must be the hosted domain**. A passkey only works on the RP ID it
  was created for: localhost passkeys do not work on the hosted site and vice versa.
- `RP_ORIGINS`: exact origins (scheme + host + port) allowed for CORS and accepted in WebAuthn
  responses. Add every Pages URL you open the app on. For Android add
  `android:apk-key-hash:<hash>` (below). iOS native responses carry `https://<RP_ID>`.
- Local function: `supabase functions serve passkey --no-verify-jwt --env-file supabase/.env.local`
  with the same variables plus `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` from `supabase status`.
- Tests: `deno test --no-lock supabase/functions/passkey/handler.test.ts`.

## Cloudflare Pages

- `npx expo export -p web` copies `public/` into `dist/`, so `/.well-known/*` and `_headers` ship
  with every deploy. `_headers` makes Pages serve the extension-less
  `apple-app-site-association` as `application/json`.
- Check after deploy:
  `curl -sI https://kindred.pages.dev/.well-known/apple-app-site-association | grep -i content-type`.
- Apple fetches the AASA through its CDN; changes can take a while to reach devices. During
  development, `webcredentials:kindred.pages.dev?mode=developer` in `associatedDomains` bypasses
  the CDN on devices with developer mode on.
- `pages.dev` is on the public suffix list, so `kindred.pages.dev` is a valid RP ID on its own.
  A custom domain later means a new RP ID and new passkeys.

## Native development build (iOS / Android)

Passkeys in the native app need a development build (`npx expo run:ios` / `run:android` or EAS);
Expo Go cannot load `react-native-passkey`. Changes for `app.json` (owned by the foundation agent;
not applied here):

```jsonc
{
  "expo": {
    "ios": {
      "bundleIdentifier": "uk.kindred.app",
      "associatedDomains": ["webcredentials:kindred.pages.dev"],
      "deploymentTarget": "15.1" // via expo-build-properties if the SDK default is lower
    },
    "android": {
      "package": "uk.kindred.app"
      // Passkeys need only assetlinks.json with get_login_creds. Add this only if the app
      // should also open https://kindred.pages.dev links:
      // "intentFilters": [{ "action": "VIEW", "autoVerify": true,
      //   "data": [{ "scheme": "https", "host": "kindred.pages.dev" }],
      //   "category": ["BROWSABLE", "DEFAULT"] }]
    }
  }
}
```

Then fill in the placeholders and redeploy the site:

- **iOS:** replace `TEAMID` in `public/.well-known/apple-app-site-association` with the Apple
  Developer Team ID (`TEAMID.uk.kindred.app`). Associated domains need a paid developer account
  and a signed build.
- **Android:** get the signing certificate's SHA-256
  (`keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android`,
  or `eas credentials` / Play Console for release) and
  1. put it (colon form `AB:CD:…`) into `sha256_cert_fingerprints` in `assetlinks.json`;
  2. add `android:apk-key-hash:<base64url of the same bytes>` to `RP_ORIGINS`:
     `echo AB:CD:… | tr -d : | xxd -r -p | base64 | tr '+/' '-_' | tr -d =`.
  Android 9 (API 28)+ with Google Play services; the app reports unsupported below that.

## Known limits

- Expo Go: no passkeys; `isPasskeySupported()` is `false` and the UI should offer email + password.
- Web dev: `http://localhost:8081` works in Chrome and Safari (localhost counts as secure). A LAN
  IP (`http://192.168.x.x:8081`) does not; use the hosted site or a tunnel with its own RP ID.
- RP ID must equal the hosted domain (or be a parent of it); the iOS app only works with the RP ID
  in `associatedDomains`, which is the first `RP_ID` entry.
- Account recovery is email + password reset; a user who signed up with a passkey only has no
  password until they set one.
- Adding a passkey on a second device: sign in there, then `addPasskeyToCurrentUser()`. Synced
  passkeys (iCloud Keychain, Google Password Manager) appear on the user's other devices anyway.
- Untested against a live project so far: the `verifyOtp` type (`'email'`, falls back to
  `'magiclink'`), the native response shape from `react-native-passkey`, and real authenticators.
