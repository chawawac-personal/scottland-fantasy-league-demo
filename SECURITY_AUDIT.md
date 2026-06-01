# Security Audit — Scottland Fantasy League

**Last updated:** 2026-06-01  
**Project:** Scottland FC Fantasy League — Next.js 15 + Supabase  
**Scope:** Full codebase — all 13 OWASP-aligned security areas  

---

## Summary

| Severity | Audit 1 (2026-05-29) | Audit 2 (2026-06-01) | Status |
|----------|---------------------|---------------------|--------|
| 🔴 Critical | 2 fixed | 3 found · 2 fixed · 1 open | See CRIT-1 below |
| 🟠 High | 2 fixed | 5 found · 3 fixed · 2 open | Rate limiting + notif stub |
| 🟡 Medium | 4 fixed | 8 found · 8 fixed | All resolved |
| 🟢 Low | 1 fixed | 6 found · 3 fixed · 3 low-risk | Accepted or intentional |
| **Total** | **9 resolved** | **22 found · 16 fixed** | |

**One open critical action: rotate `SUPABASE_SERVICE_ROLE_KEY` in the Supabase dashboard immediately** — it was exposed in a chat conversation on 2026-06-01.

---

## Audit 1 — 2026-05-29 (all resolved)

---

### F1 — No `.gitignore` · Critical · Secrets

**File:** `(project root)` — file did not exist

**Issue:** No `.gitignore` existed. Running `git add .` would have committed `.env.local`, exposing `SUPABASE_SERVICE_ROLE_KEY` (bypasses all RLS, grants full database access) and all future secrets.

**Fix:** Created `.gitignore` excluding all `.env*` files. Created `.env.example` documenting required variables.

---

### F2 — Next.js Middleware Bypass CVE · Critical · Dependencies

**File:** `package.json` — `next: 15.3.2`

**Issue:** Critical CVE: *"Next.js Middleware / Proxy bypass via segment-prefetch routes."* Unauthenticated users could bypass the entire middleware auth layer.

**Fix:** Updated Next.js to the latest patched release via `npm install next@latest`.

**Accepted risk:** Moderate PostCSS advisory inside Next.js's own bundled build tooling. Build-time only, not exploitable at runtime. Fixing it would require downgrading Next.js to 9.3.3.

---

### F3 — Form Data Spread Directly Into Database Insert · High · Permissions

**File:** `app/(auth)/onboarding/page.tsx:25`

**Issue:** `...form` spread into Supabase upsert — attacker could inject `role: "admin"` via DevTools before submit.

**Fix:** Enumerated every allowed field explicitly with enforced length limits. Also applied `REVOKE INSERT (role, level, xp, fantasy_points) ON public.profiles FROM authenticated` at the database level.

---

### F4 — Wildcard Image Hostname Enables SSRF · High · Insecure Configuration

**File:** `next.config.ts:6`

**Issue:** `remotePatterns: [{ hostname: "**" }]` allowed the image optimizer to proxy any URL server-side — an SSRF vector.

**Fix:** Restricted to specific known origins (Supabase Storage, Google OAuth avatars).

---

### F5 — Raw Supabase Error Messages Shown to Users · Medium · Error Messages

**Files:** `app/(auth)/login/page.tsx:21`, `app/(auth)/register/page.tsx:20`

**Issue:** `error.message` from Supabase SDK passed directly to UI, exposing auth provider internals.

**Fix:** Generic messages: "Invalid email or password" for login; mapped messages for register with generic fallback.

---

### F6 — Development URL in `NEXT_PUBLIC_SITE_URL` · Medium · Insecure Configuration

**File:** `.env.local:4`

**Issue:** `NEXT_PUBLIC_SITE_URL=http://localhost:3000` baked into browser bundle. OAuth and signout redirects would break in production.

**Fix:** Documented correct production value in `.env.example`. Action required before go-live.

---

### F7 — Auth Callback Ignores Exchange Failure · Medium · Authentication

**File:** `app/auth/callback/route.ts:13`

**Issue:** `exchangeCodeForSession(code)` result was discarded — users were silently redirected to `/dashboard` even on auth failure.

**Fix:** Checks error result; redirects to `/login?error=auth_failed` on failure.

---

### F8 — `role` Column INSERT Privilege Not Revoked · Medium · Permissions

**Database:** `public.profiles`

**Issue:** `REVOKE UPDATE` was applied but not `REVOKE INSERT`. A user scripting the profile creation endpoint could send `role: 'admin'` during signup.

**Fix:** `REVOKE INSERT (role, level, xp, fantasy_points) ON public.profiles FROM authenticated`

---

### F9 — `?next=` Redirect Param Unvalidated · Low · Authentication

**Files:** `middleware.ts:52`, `app/(auth)/login/page.tsx:22`

**Issue:** Middleware set `?next=` but login page ignored it. Latent open-redirect surface if later wired up without validation.

**Fix:** Added `safeRedirect()` validator — only permits relative paths, blocks `//evil.com` pattern. Login page now consumes the param.

---

## Audit 2 — 2026-06-01

---

### CRIT-1 — Live `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` · **OPEN — ACTION REQUIRED**

**File:** `.env.local`

**Issue:** The service role key is present in the working tree. It was shared in a chat conversation on 2026-06-01 and must be treated as compromised. This key bypasses every Supabase RLS policy — anyone with it has unrestricted read/write/delete access to all tables.

**Fix required:**
1. Rotate the key in the Supabase dashboard → Project Settings → API
2. Update `.env.local` with the new key
3. Confirm `.env.local` was never committed: `git log --all --full-history -- .env.local`
4. The key is not used anywhere in the current codebase — remove it from `.env.local` entirely

---

### CRIT-2 — Admin Mutations Execute From Browser Client With No Server Auth Re-check · Fixed

**File:** `app/(app)/admin/page.tsx` (multiple functions)

**Issue:** All admin write operations — saving feature flags, entering match stats, updating match status, adding fixtures, saving league prizes — were performed directly from a `"use client"` component using the anon key. Authorization depended entirely on Supabase RLS. An attacker who bypassed the React layout check could call the same PostgREST endpoints directly from a browser console.

**Fix:** Created `lib/actions/admin.ts` with six `"use server"` actions. Each calls `requireAdmin()` which independently verifies `supabase.auth.getUser()` and `profile.role === "admin"` server-side before executing any mutation. `admin/page.tsx` now calls these server actions instead of the browser client.

---

### CRIT-3 — User Role Escalation Performed From Browser Client · Fixed

**File:** `app/(app)/admin/page.tsx:594`

**Issue:** The role change dropdown called `supabase.from("profiles").update({ role })` directly from the browser. Authorization was RLS-only. Also queried by `username` string (mutable) instead of `user_id` (stable UUID).

**Fix:** `updateUserRoleAction(userId, role)` server action added to `lib/actions/admin.ts`. Now uses the profile's real UUID. `VALID_ROLES` allowlist rejects any value outside `["user", "manager", "moderator", "admin"]`. The `users` state was updated to carry `userId` (real UUID) alongside the synthetic display `id`.

---

### HIGH-1 — Chat Delete Has No Server-Side Ownership Verification · Fixed

**File:** `app/(app)/community/page.tsx:199`

**Issue:** `deleteMessage()` called `supabase.from("chat_messages").delete().eq("id", msgId)` from the browser — no ownership check. The delete button was hidden for non-owners in the UI but nothing prevented a direct API call.

**Fix:** `deleteChatMessageAction(msgId)` in `lib/actions/chat.ts`. Server-side: queries with both `.eq("id", msgId).eq("user_id", user.id)` — can only delete a message the caller owns.

---

### HIGH-2 — `getLeagueStandings` Returns Private League Data to Non-Members · Fixed

**File:** `lib/actions/leagues.ts:52`

**Issue:** Any authenticated user could call this server action with any `leagueId` and receive the full member list, usernames, and points — even for leagues they never joined.

**Fix:** Added a membership check before returning data. If no row exists for `(leagueId, user.id)` in `league_members`, the function returns an empty array.

---

### HIGH-3 — No Rate Limiting on Login, Signup, or Username Lookup RPC · **OPEN**

**Files:** `lib/actions/auth.ts`, `middleware.ts`

**Issue:** No application-level rate limiting on login, signup, or the `resolve_login_identifier` RPC (which reveals whether a username exists). Brute-force and credential-stuffing attacks are unconstrained.

**Recommended fix:** Add Upstash Redis rate limiting in the auth server actions, or configure Supabase Auth rate limits in the dashboard (Auth → Rate Limits). Return HTTP 429 with `Retry-After` header when limits are hit.

---

### HIGH-4 — `?next=` Redirect Param Unvalidated in Auth Callback · Fixed

**File:** `app/auth/callback/route.ts:8`

**Issue:** `const next = url.searchParams.get("next") ?? "/dashboard"` was appended directly to `${origin}` with no validation. A crafted OAuth link could redirect users to arbitrary paths after login.

**Fix:** `safeRedirect()` helper (same validator used on the login page) applied to the `next` param before use. Only relative paths that start with `/` but not `//` are permitted.

---

### HIGH-5 — Broadcast Notification Is a Silent Stub · **OPEN**

**File:** `app/(app)/admin/page.tsx:196`

**Issue:** The "Send to All Users" button in the admin panel sleeps 1 second and clears the form — it sends nothing. Admins believe notifications are being sent when they are not.

**Recommended fix:** Implement as a `"use server"` action (verified admin role required) that bulk-inserts into the `notifications` table for all user IDs, or integrate with a push notification provider.

---

### MED-1 — Profile Update Has No Server-Side Field Validation · Fixed

**File:** `app/(app)/profile/page.tsx:105`

**Issue:** `editForm` was passed directly to `supabase.from("profiles").update(editForm)` from the browser. No server-side type, length, or allowlist validation.

**Fix:** `updateProfileAction` in `lib/actions/profile.ts`. Validates max lengths server-side (`full_name` ≤ 100, `bio` ≤ 300, etc.) before executing the update. `profile/page.tsx` now calls the server action.

---

### MED-2 — League Creation Generated Invite Code Client-Side, Bypassed Server Action · Fixed

**File:** `app/(app)/leagues/page.tsx:155`

**Issue:** `handleCreateLeague()` called `generateInviteCode()` in the browser using `Math.random()`, then inserted directly to `leagues` bypassing the existing `createLeague` server action.

**Fix:** `handleCreateLeague()` now calls the `createLeague` server action exclusively. The invite code is generated server-side. The server action was updated to accept an optional `prizes` parameter and apply input length limits.

---

### MED-3 — Chat Messages Have No Server-Side Length Cap · Fixed

**File:** `app/(app)/community/page.tsx:183`

**Issue:** `maxLength={200}` on the HTML input is client-side only. A user bypassing the UI could insert arbitrarily long messages.

**Fix:** `sendChatMessageAction` in `lib/actions/chat.ts` rejects any message where `trimmed.length > 200` or `trimmed.length === 0` server-side.

---

### MED-4 — Join Flow Reveals Whether Invite Code Is Valid · Fixed

**File:** `lib/actions/leagues.ts` (previously in `leagues/page.tsx`)

**Issue:** Distinct error messages ("Invalid invite code" vs "Already a member") allowed enumeration of valid invite codes without joining.

**Fix:** Both cases now return the same message: "Unable to join league. Please check the invite code." The client-side join flow was also replaced with a call to the `joinLeague` server action (eliminating the separate client-side lookup that produced the distinct error).

---

### MED-5 — `select("*")` on `profiles` Sends Phone Number and Internal Fields to Browser · Fixed

**File:** `app/(app)/profile/page.tsx:50`

**Issue:** `select("*")` returned all columns including `phone`, `role`, and internal timestamps to the browser client.

**Fix:** Replaced with explicit column list: `username, full_name, avatar_url, xp, level, fantasy_points, favorite_player, supporter_branch, bio`.

---

### MED-6 — `generateInviteCode` Uses `Math.random()` · Fixed

**File:** `lib/utils.ts:54`

**Issue:** `Math.random().toString(36).substring(2, 8)` — not cryptographically secure. The 6-character base36 output is brute-forceable.

**Fix:** Replaced with `globalThis.crypto.randomUUID().replace(/-/g, "").substring(0, 8).toUpperCase()` — 8 hex characters from a CSPRNG. Works in Node.js 18+ and modern browsers.

---

### MED-7 — Middleware Bypassed All `/api/` Routes · Fixed

**File:** `middleware.ts:13`

**Issue:** `pathname.startsWith("/api/")` was in the early-exit bypass list. Future API routes would not receive session-refresh middleware, potentially leading to developers incorrectly assuming auth is handled for them.

**Fix:** Removed `/api/` from the bypass. The session refresh now runs on API routes. The only current API route (`/api/auth/signout`) performs its own auth check and is unaffected.

---

### LOW-1 — Fragile `NEXT_REDIRECT` Error Detection · Fixed

**Files:** `app/(app)/layout.tsx:28`, `app/(app)/admin/layout.tsx:22`

**Issue:** `err.message === "NEXT_REDIRECT"` relies on an undocumented internal string. If Next.js changes it, redirect protection silently breaks.

**Fix:** Replaced with `import { isRedirectError } from "next/dist/client/components/redirect-error"` and `if (isRedirectError(err)) throw err`.

---

### LOW-2 — Phone-Only Signup Creates Synthetic `@sfc.internal` Email · Open (low priority)

**File:** `app/(auth)/register/page.tsx:10`

**Issue:** Phone-number users get a synthetic email `<digits>@sfc.internal`. Email verification silently fails; the phone number is also the account identifier and is predictable.

**Recommended fix:** Use Supabase's native phone auth (`signInWithOtp`) for phone-based flows. Requires checking Supabase plan for phone auth availability.

---

### LOW-3 — Invite Code Visible in Plain Text in League Modal · Accepted

**File:** `app/(app)/leagues/page.tsx:659`

**Issue:** The invite code is displayed to all league members in the detail modal. Screenshots or recordings of the modal leak the code.

**Assessment:** Intentional design — members need the code to invite others. Document this intentionally for the team. Consider adding a "Regenerate code" button for league owners to rotate after an unwanted join.

---

### LOW-4 — No Content Security Policy Headers · Fixed

**File:** `next.config.ts`

**Issue:** No CSP, `X-Frame-Options`, or other security headers configured.

**Fix:** Added to `next.config.ts`:
- `Content-Security-Policy` — restricts scripts, styles, images, and connections to known origins
- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

### LOW-5 — "Mark All Read" Updates Local State Only · Open (UX bug)

**File:** `components/layout/TopBar.tsx:72`

**Issue:** Notifications re-appear as unread on next page load because the DB is never updated.

**Recommended fix:** Add a `"use server"` action that sets `read = true` for all notifications where `user_id = auth.uid()`.

---

### LOW-6 — Admin Route Relies Solely on Layout Server Check · Accepted

**File:** `app/(app)/admin/layout.tsx`

**Issue:** `/admin` is protected by a server layout redirect, not by middleware. Defense-in-depth concern only — if the layout were bypassed (e.g. a nested route escapes it), the page would be exposed. Not an active vulnerability with current routing.

**Assessment:** Acceptable for this project size. Consider adding `/admin` to the middleware's protected-path check as defense in depth.

---

## Second-Pass Verification (2026-06-01)

After all fixes from Audit 2 were applied, the codebase was checked for regressions:

| Check | Result |
|---|---|
| Remaining direct browser-client mutations (`createClient().from().update/insert/delete`) in `app/` | **None found** |
| TypeScript compiler errors after changes | **None** |
| `Math.random()` in invite code generation | **Removed** |
| `NEXT_REDIRECT` string comparison in layouts | **Removed** |
| `/api/` bypass in middleware | **Removed** |
| `select("*")` on profiles in profile page | **Replaced with explicit columns** |
| Unvalidated `?next=` in auth callback | **Fixed** |

---

## All Files Changed Across Both Audits

| File | Audit | Change |
|---|---|---|
| `.gitignore` | 1 | Created — excludes all `.env*` files |
| `.env.example` | 1 | Created — documents required variables |
| `package.json` | 1 | Next.js updated to patched version |
| `app/(auth)/onboarding/page.tsx` | 1 | Explicit field enumeration, length limits |
| `app/(auth)/login/page.tsx` | 1 | Generic error message, consumes `?next=` safely |
| `app/(auth)/register/page.tsx` | 1 | Generic error messages, input length limits |
| `app/auth/callback/route.ts` | 1 + 2 | Validates exchange result on failure; `?next=` now validated with `safeRedirect()` |
| `next.config.ts` | 1 + 2 | Restricted image origins (audit 1); added CSP + security headers (audit 2) |
| `middleware.ts` | 2 | Removed `/api/` blanket bypass |
| `lib/utils.ts` | 2 | `generateInviteCode` uses `crypto.randomUUID()` |
| `lib/actions/admin.ts` | 2 | **Created** — 6 server actions with `requireAdmin()` guard |
| `lib/actions/chat.ts` | 2 | **Created** — send + delete with ownership check and length cap |
| `lib/actions/profile.ts` | 2 | **Created** — profile update with server-side validation |
| `lib/actions/leagues.ts` | 2 | `getLeagueStandings` membership check; `createLeague` prizes param + input limits; `joinLeague` unified error messages |
| `app/(app)/admin/page.tsx` | 2 | All mutations replaced with server action calls; `userId` added to user state; role change uses UUID |
| `app/(app)/community/page.tsx` | 2 | send + delete via server actions |
| `app/(app)/profile/page.tsx` | 2 | `select("*")` → explicit columns; save via server action |
| `app/(app)/leagues/page.tsx` | 2 | Create + join via server actions; removed client-side invite code generation |
| `app/(app)/layout.tsx` | 2 | `isRedirectError()` replaces string comparison |
| `app/(app)/admin/layout.tsx` | 2 | `isRedirectError()` replaces string comparison |
| Supabase DB | 1 | `REVOKE INSERT (role, level, xp, fantasy_points)` applied |

---

## Open Items Requiring Action

| Priority | Item | Owner |
|---|---|---|
| **Immediate** | Rotate `SUPABASE_SERVICE_ROLE_KEY` — exposed in chat 2026-06-01 | Developer |
| High | Add rate limiting to login/signup/auth RPCs | Developer |
| High | Implement or remove the broadcast notification stub | Developer |
| Low | Switch phone signup to Supabase native phone auth | Developer |
| Low | Implement "Mark all read" DB update | Developer |
| Low | Add "Regenerate invite code" for league owners | Developer |

---

## Ongoing Security Recommendations

### HTTPS & Cookie Security
Ensure the production deployment (Vercel) has HTTPS forced on all routes. Supabase SSR sets `Secure`, `HttpOnly`, and `SameSite=Lax` on session cookies automatically when served over HTTPS — verify this in production browser DevTools.

### HSTS
Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` to the headers in `next.config.ts` once the production domain is confirmed.

### Data Privacy
- User emails, phone numbers, and profile data are stored in Supabase — verify the data region complies with applicable regulations
- A "Delete Account" button exists in Settings but has no backend implementation — wire to `supabase.auth.admin.deleteUser()` via a server action before launch
- Add a privacy policy page before onboarding users

### Admin Role Assignment
No UI exists for granting initial admin access. The process remains:
```sql
UPDATE profiles SET role = 'admin' WHERE username = 'your_username';
```
This is intentional (no self-service escalation). Document internally.
