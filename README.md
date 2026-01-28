# 📒 Todolog (Developers Handbook)

> **Private Repository**: This document contains sensitive configuration details and deep architectural insights for the developer (You).

**Todolog** is a robust, full-stack Todo application designed with an "Offline First" feel but powered by enterprise-grade synchronization with Google Calendar. It bridges the gap between simple todo lists and complex calendar scheduling.

---

## 🏗 Architecture Overview

The system is split into two distinct parts that communicate via REST API.

### 📱 Client side (`/client`)
Built with **React Native (Expo SDK 52)** to ensure seamless performance on both iOS and Android.

- **UI Framework**: React Native + **NativeWind** (Tailwind CSS for mobile).
- **Navigation**: `React Navigation v7`.
  - **`MainStack`**: Handles the root stack (Modals, Auth, Settings).
  - **`MainTabs`**: The core application loop (Dashboard, Calendar, Search).
- **State Management Strategy**:
  - **Server State**: Managed by **TanStack Query (React Query)**. It handles caching, background refetching, and optimistic updates.
  - **Local UI State**: Managed by **Zustand**.
    - `todoFormStore`: Controls the complex form logic (Quick vs Detail modes).
    - `authStore`: Handles session tokens and user profile data.

### 🖥 Server side (`/server`)
A robust Node.js backend using **Express.js** and **MongoDB**.

- **Database**: MongoDB (Mongoose ORM).
- **Authentication**: Custom JWT implementation tied to Google OAuth 2.0.
- **Worker/Services**:
  - `GoogleCalendarService`: The heart of the sync logic. Handles token refreshing and API quotas.

---

## 🔐 Authentication & Sync Flow (The "Magic")

Understanding how the login works is crucial for debugging `401` errors.

1. **Client Authorization**:
   - User clicks "Sign in with Google" on the mobile app.
   - Expo requests an `id_token` from Google directly.
2. **Server Verification**:
   - The `id_token` is sent to `POST /api/auth/login`.
   - Server verifies the token with Google to ensure it's valid.
3. **Session Creation**:
   - Server issues its own **JWT (Access Token)** for API access.
   - Server stores the **Google Refresh Token** in the User model (encrypted) to maintain offline access to the user's calendar.
4. **Calendar Auto-Creation**:
   - On first login, `GoogleCalendarService.ensureTodoLogCalendar()` runs.
   - It checks for a calendar named **"TODOLOG"**. If missing, it creates one and saves the `calendarId` to the user's profile.

---

## 💾 Data Models & Schema Strategy

### `Todo` Model
The schema is designed for speed and complex recurrence queries.

| Field | Type | Purpose |
|-------|------|---------|
| `isAllDay` | Boolean | Determines if we send `date` (YYYY-MM-DD) or `dateTime` to Google. |
| `recurrence` | [String] | Stores raw RRULE strings (e.g., `FREQ=WEEKLY`) for Google API compatibility. |
| `recurrenceEndDate` | Date | **Crucial Optimization**: Flattened date derived from RRULE. Allows MongoDB to query "Active recurring todos" using standard date operators (`$lte`) without parsing RRULE strings in the DB. |
| `googleCalendarEventId` | String | Links the local Todo to the remote Google Event. Used for updates/deletes. |
| `syncStatus` | Enum | `synced`, `pending`, `failed`. Used for retry logic. |

---

## 🛠 Setup & Secrets (Environment Variables)

**⚠️ DO NOT SHARE THESE VALUES PUBLICLY.**

### 1. Client Setup (`client/.env`)
Create this file in the `client` root.

\`\`\`env
# Local Development (Simulator/Emulator)
EXPO_PUBLIC_API_URL=http://localhost:5000/api

# Physical Device (Requires real IP)
# EXPO_PUBLIC_API_URL=http://192.168.x.x:5000/api
\`\`\`

### 2. Server Setup (`server/.env`)
Create this file in the `server` root.

\`\`\`env
# Application Port
PORT=5000

# Database Connection
MONGODB_URI=mongodb://localhost:27017/todolog

# Security (JWT)
# Generate a random string: openssl rand -base64 32
JWT_SECRET=super_secret_jwt_key_should_be_long

# Google OAuth (GCP Console Credentials)
# Project: [Your GCP Project Name]
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
\`\`\`

---

## 🐛 Troubleshooting Guide

### 1. "Nested Git Repository" Error
If you cannot open the `client` folder on GitHub (shows as a white arrow):
**Fix**: The `client` folder has its own `.git` directory.
\`\`\`bash
# Run from project root
rm -rf client/.git
git rm --cached client
git add client
git commit -m "Fix nested git"
\`\`\`

### 2. Form Logic (Quick vs Detail)
The form is not a simple modal. It listens to keyboard events.
- **Quick Mode**: Opens just above the keyboard. Height is dynamic based on `KeyboardStickyView`.
- **Detail Mode**: Expands to full screen.
- **Debug**: Check `client/src/store/todoFormStore.js` to see which mode is active.

### 3. Google Calendar Sync Fails
- Check server logs for `401 Unauthorized`.
- If a user revokes access in their Google Account settings, the server detects this and automatically sets `user.hasCalendarAccess = false`.
- The user must re-login to fix it.

---

## 📂 Key Files Cheatsheet

- **Entry Point**: `client/App.js`, `server/src/index.js`
- **Navigation Map**: `client/src/navigation/MainStack.js`
- **Sync Logic**: `server/src/services/googleCalendar.js`
- **Form State**: `client/src/store/todoFormStore.js`
- **Tailwind Config**: `client/tailwind.config.js` (Defines custom colors/fonts)

---

### 🚀 Deployment Scripts

**Server**:
\`\`\`bash
cd server
npm start
\`\`\`

**Client**:
\`\`\`bash
cd client
npx expo start
# Press 'i' for iOS simulator
# Press 'a' for Android emulator
\`\`\`
