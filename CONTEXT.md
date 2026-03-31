# Codebase Context: Accel Net (network-mapper)

This document provides a concise overview of the project for onboarding and AI-assisted development. The repo is named **network-mapper**; the application is **Accel Net** (v4.1.0)—a social media web app.

---

## 1. What This Project Is

- **Accel Net**: A React SPA that works like a lightweight Twitter/X-style social network.
- **Features**: Auth (email + Google), profiles, posts (text + images), comments, replies, likes, bookmarks, follow/following, notifications, search, settings (block, report, reset password), and email notifications via Firebase Cloud Functions.
- **Backend**: Firebase (Auth, Firestore, Storage). Optional Cloud Functions for sending notification emails (Nodemailer).
- **Deployment**: Firebase Hosting (firebase.json; SPA rewrite to index.html). Local development via `pnpm dev`.

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | React 18 |
| **Build** | Vite 4 |
| **Routing** | react-router-dom v6 |
| **Styling** | Tailwind CSS 3, some styled-components / Emotion |
| **State** | React Context (`UserDataContext`), local `useState` |
| **Backend** | Firebase (Auth, Firestore, Storage) |
| **Cloud** | Firebase Cloud Functions (Node 18, Nodemailer) |
| **UI/UX** | Framer Motion, react-toastify, react-icons, react-helmet, linkify-react |

---

## 3. Project Structure

```
network-mapper/
├── src/
│   ├── main.jsx              # Entry: React root + BrowserRouter
│   ├── App.jsx               # Routes + UserDataProvider + ToastContainer
│   ├── config/
│   │   ├── config.js         # App metadata, theme ref, animation/layout/post/toast config
│   │   └── theme.js          # Design tokens (colors, typography, spacing, z-index)
│   ├── component/            # Reusable feed/profile components
│   │   ├── addcomment.jsx, comment.jsx, createpost.jsx, post.jsx, profile.jsx, suggestion.jsx
│   ├── layout/               # Shell and feature layouts
│   │   ├── layout.jsx        # Main shell: Navbar + main content + optional Suggestion sidebar
│   │   ├── navbar/, login/, explore/, notification/, post/, profile/, Reply/, setting/
│   │   └── Comment/
│   ├── page/                 # Route-level pages
│   │   ├── home, loginpage, signuppage, create-account, profilepage, seepost
│   │   ├── search, notification, list, setting, not-found
│   ├── service/
│   │   ├── Auth/
│   │   │   ├── index.js      # Firebase init + signInWithGoogle, signinwithemail, signupwithemail, forget_password
│   │   │   └── database.js   # Firestore/Storage: user, post, comment, notification CRUD + email trigger
│   │   ├── context/
│   │   │   └── usercontext.jsx  # UserDataProvider: userdata, notifications, saved, delete_post, handlesave
│   │   ├── email/
│   │   │   └── emailService.js  # Calls Cloud Function or fallback for notification emails
│   │   └── utiles/           # createid, time, useTop
│   └── ui/                   # Shared UI primitives (button, card, input, avatar, popup, skeleton, etc.)
├── functions/                # Firebase Cloud Functions
│   └── index.js              # sendNotificationEmail (HTTP + callable), Nodemailer
├── public/
├── index.html, vite.config.js, tailwind.config.js, postcss.config.js
├── firebase.json                 # Firebase Hosting + Functions config
└── .github/workflows/ci_cd.yml   # Install, lint, build on push/PR to main
```

---

## 4. Key Conventions & Patterns

- **Auth**: Firebase Auth; on login, user doc is loaded via `get_userdata(uid)`. If no `username`, user is sent to `/create-account` to complete profile.
- **User state**: `userdata` is held in `App` state and provided via `UserDataProvider`; it includes profile, `post[]`, `saved[]`, `follower`/`following`, etc. Persisted to Firestore in `database.js` (`updateuserdata`).
- **Routing**: Public: `/`, `/login`, `/create-account`. Protected (inside `Layout`): `/home`, `/search`, `/profile/:username`, `/profile/:username/:postid`, `/setting`, `/notification`, `/bookmarks`. Catch-all `*` → Notfound.
- **Layout**: `Layout` wraps protected pages: left Navbar, center main (max-w-[600px]), optional right Suggestion sidebar (hidden on small screens).
- **Theme**: Centralized in `src/config/theme.js` and mirrored in `tailwind.config.js` (e.g. `bg-bg-default`, `text-text-primary`, `accent-500`, `border-border-default`). Dark-first (black backgrounds, light text).
- **Config**: `src/config/config.js` exports app name/version, theme reference, animation variants, layout widths, post limits, toast settings.
- **Env**: Firebase uses `import.meta.env.VITE_*` (VITE_ApiKey, VITE_AuthDomain, VITE_ProjectId, VITE_StorageBucket, VITE_MessagingSenderId, VITE_AppId, VITE_MeasurementId). No `.env` is committed; document in README or CONTEXT.

---

## 5. Data Model (Firestore)

- **user**: email, name, uid, dateofbirth, bio, profileImageURL, username, follower[], following[], blockusers[], saved[], post[] (post metadata), report[], restricted, privacy, notification count, createdAt.
- **notification**: uid, intent (type, likeby, postid, etc.), time.
- Posts and comments are referenced from user docs and/or separate collections; post images in Firebase Storage.

---

## 6. Notifications & Email

- In-app: `Create_notification` in `database.js` writes to Firestore and triggers `sendNotificationEmail` (in `emailService.js`). Email is sent for types: postlike, commentlike, addcomment, addreply, replylike, follow.
- Backend: `functions/index.js` exposes `sendNotificationEmail` (HTTP) and `sendNotificationEmailCallable`. Email is configured via Firebase config (`email.user`, `email.password`, `email.service`).

---

## 7. Scripts & Deployment

- **Local**: `pnpm dev` (Vite, host 0.0.0.0) — app at http://localhost:5173.
- **Build**: `pnpm build` (Vite). Lint: `pnpm lint`. Format: `pnpm format` (Prettier).
- **Functions**: `cd functions && pnpm run serve` (emulators), `pnpm run deploy` (deploy only functions).
- **CI**: GitHub Actions on push/PR to `main` — install, lint, build (pnpm).
- **Firebase Hosting**: `firebase deploy --only hosting` after `pnpm build`. SPA rewrite so all routes serve `index.html`.

---

## 8. File Naming & Code Style

- Mix of PascalCase and lowercase for components (e.g. `createpost.jsx`, `navbar.jsx`, `likePost.tsx`). Pages and layout components are often PascalCase.
- One TS file present: `likePost.tsx`; rest JSX/JS.
- ESLint + Prettier in use; Tailwind for layout and styling.

---

## 9. Quick Reference for Common Tasks

- **Add a route**: Edit `App.jsx` (Routes + optional `Layout`), add page under `src/page/`.
- **Change theme/colors**: `src/config/theme.js` and `tailwind.config.js` (keep in sync).
- **Auth/database helpers**: `src/service/Auth/index.js`, `src/service/Auth/database.js`.
- **Global user state**: `src/service/context/usercontext.jsx` — use `useUserdatacontext()`.
- **Email content/trigger**: `src/service/email/emailService.js` and `src/service/Auth/database.js` (Create_notification); backend in `functions/index.js`.

---

*Last updated from codebase assessment. Repo name: network-mapper. App name: Accel Net.*
