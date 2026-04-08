# Accel Net (network-mapper)

React social media app (Accel Net) — run locally with pnpm.

## Prerequisites

- [Node.js](https://nodejs.org/) (v22+ recommended)
- [pnpm](https://pnpm.io/installation) (project uses pnpm for package management)

## Setup

1. Clone the repository:

   ```bash
   git clone <your-repo-url>
   cd network-mapper
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Configure environment variables. Copy `.env.example` to `.env` and fill in your values (Firebase config is required; see [Firebase console](https://console.firebase.google.com) → Project settings → Your apps).

## Run locally

```bash
pnpm dev
```

The app runs at **http://localhost:5173** (Vite default). It’s served with `--host 0.0.0.0` so you can access it from other devices on your network.

## Ingest users from CSV

Ingest users and profiles from `./data/2024.csv` (creates Firebase Auth users and Firestore profiles):

1. Create a [Firebase service account](https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk) and download the JSON key.
2. Set `GOOGLE_APPLICATION_CREDENTIALS` to the key path, or run `gcloud auth application-default login`.
3. Run:
   - **Preview only**: `pnpm ingest:users --dry-run`
   - **Full run**: `pnpm ingest:users`
   - **Limit rows**: `pnpm ingest:users --limit 10`
   - **Custom file**: `pnpm ingest:users --file ./data/other.csv`
   - **Custom password**: `pnpm ingest:users --password "YourTempPassword"`

New users are created with the default password `NetMap2024!` (or your custom one) and should reset it on first login.

## Other scripts

- `pnpm build` — production build (output in `dist/`)
- `pnpm preview` — preview production build locally
- `pnpm lint` — run ESLint
- `pnpm format` — format with Prettier

## Deploy to Firebase Hosting

1. Install the [Firebase CLI](https://firebase.google.com/docs/cli): `pnpm add -g firebase-tools` (or `npm install -g firebase-tools`)
2. Log in and select your project: `firebase login` then `firebase use <project-id>`
3. Build the app: `pnpm build`
4. Deploy hosting (and optionally functions): `firebase deploy`

   - Hosting only: `firebase deploy --only hosting`
   - Functions only: `firebase deploy --only functions`
   - **Firestore rules** (required for profiles/notifications/tags): `firebase deploy --only firestore:rules`
   - **Storage rules** (required for avatar/uploads): `firebase deploy --only storage`
   - Both: `firebase deploy`

The app will be live at `https://<project-id>.web.app` (or your custom domain if configured).

### Search analytics (optional)

The `recordSearch` Cloud Function receives search requests from the explore page and stores them in Firestore (`searches` collection: uid, query, options, results). To enable:

1. Deploy functions: `firebase deploy --only functions`
2. Add to `.env`: `VITE_SearchAnalyticsUrl=https://REGION-PROJECT.cloudfunctions.net/recordSearch` (replace with your function URL)

If the URL is not configured, search still works but requests are not recorded.

## Troubleshooting

- **Port in use**: Change the port in the dev command, e.g. `pnpm dev -- --port 3000`, or stop the process using port 5173.
- **Nothing saving to Firestore / "Permission denied"**: Deploy Firestore security rules: `firebase deploy --only firestore:rules`. Rules are in `firestore.rules`.
- **Avatar upload fails**: Deploy Storage security rules: `firebase deploy --only storage` (rules are in `storage.rules`).
- **CORS error loading images from Firebase Storage** (e.g. "blocked by CORS policy" when opening images on `http://localhost:5173`): The Storage bucket must have CORS configured. Use [Google Cloud gsutil](https://cloud.google.com/storage/docs/gsutil_install):
  1. Install and log in: `gcloud auth login` and set the project: `gcloud config set project gv-network-mapper-dev` (ignore the “environment” tag message if shown).
  2. Find your bucket name: run `gsutil ls` or check [Firebase Console → Storage](https://console.firebase.google.com) (bucket is often `PROJECT_ID.firebasestorage.app` or `PROJECT_ID.appspot.com`).
  3. Apply CORS (use the bucket name from step 2):
     ```bash
     gsutil cors set storage-cors.json gs://gv-network-mapper-dev.firebasestorage.app
     ```
     If that bucket doesn’t exist, try `gs://gv-network-mapper-dev.appspot.com` instead.

## Admin & tags

- **Admin users**: Any user whose profile has `isAdmin: true` can access `/admin/users` and `/admin/tags`. Security rules use **profile.isAdmin** (the profile document’s `isAdmin` field).
- **Profile document path**: New accounts are stored at `profiles/{uid}` (document ID = Firebase Auth UID). Existing accounts are migrated on first read: a copy is written to `profiles/{uid}` so rules can check `get(profiles/request.auth.uid).data.isAdmin`.
- **First admin**: Set `isAdmin: true` on that user’s profile in Firestore. If the profile is under an old auto-generated document ID, create (or copy) a document at **`profiles/{that user's Auth UID}`** with `isAdmin: true` and other profile fields so rules can read it. Deploy rules: `firebase deploy --only firestore:rules`. After that, tag/category and custom field writes will succeed. Later admins can be promoted from another admin’s profile menu.
- **"Missing or insufficient permissions" on Tags**: Deploy rules and ensure the admin’s profile exists at `profiles/{uid}` with `isAdmin: true`.
- **Tag system**: Tag categories and tags are managed at **Admin → Tags** (`/admin/tags`). These will be used later to assign tags to profile fields (one field per category).
