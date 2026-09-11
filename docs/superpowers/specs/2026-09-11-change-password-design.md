# Change Password (In-App) — Design

Date: 2026-09-11

## Goal
Let the signed-in admin change their password inside the app (no Supabase dashboard required).

## Approach
- Route: `/settings/password` under the dashboard layout (middleware already requires auth).
- Form fields: current password, new password, confirm new password.
- Flow:
  1. Validate new password length (min 8) and that confirm matches.
  2. `signInWithPassword` with the session user's email + current password.
  3. On success, `updateUser({ password: newPassword })`.
  4. Toast success; stay signed in; clear the form.
- Entry point: “Change password” link in the header (desktop near Sign out; mobile menu).

## Non-goals
- Forgot-password email flow
- Multi-user account settings
