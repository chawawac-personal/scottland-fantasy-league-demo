# End-to-End Test Report
**Scottland Fantasy League — OMNI Global**
**Date:** 30 May 2026
**Tester:** Claude (automated API + behaviour testing)
**Environment:** Production Supabase project `hinnvqadajjmoouvsuad` · Next.js app on localhost:3000

---

## Summary

| Severity | Count | Status |
|---|---|---|
| 🔴 Broken | 3 | Fixed during this session |
| 🟡 Wrong | 5 | 2 fixed, 3 flagged for decision |
| 🟢 Passing | 23 | All confirmed correct |

---

## 🔴 BROKEN — Fixed During This Session

### B1. Registration completely broken for all new users

| Field | Detail |
|---|---|
| **What I did** | `POST /auth/v1/signup` with valid email, password, username |
| **Expected** | User created, profile row inserted, redirect to `/privacy?from=onboarding` |
| **Actual** | HTTP 500 — `"Database error saving new user"` on every attempt regardless of email domain or username |
| **Where** | `POST https://hinnvqadajjmoouvsuad.supabase.co/auth/v1/signup` |

**Root cause:** The `handle_new_user` trigger on `auth.users` inserts a row into `public.profiles` after every signup. The `profiles` table has Row Level Security enabled with an INSERT policy of `auth.uid() = id`. During account creation, `auth.uid()` returns `NULL` — so the RLS check fails and the INSERT is silently rejected, causing the entire auth transaction to roll back. Although the function uses `SECURITY DEFINER`, Supabase's PostgreSQL implementation does not bypass RLS for `SECURITY DEFINER` functions unless `SET row_security = off` is explicitly declared.

**Fix applied:** Rewrote `handle_new_user` in `lib/supabase/fix_trigger.sql`:
```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off   -- ← this was the missing line
AS $$ ... $$;
```
Also added a `EXCEPTION WHEN unique_violation` fallback that appends a 4-digit random suffix to the username if a collision occurs.

---

### B2. `manager` role blocked by check constraint

| Field | Detail |
|---|---|
| **What I did** | Admin attempted to set a user's role to `'manager'` via the Admin → Users dropdown |
| **Expected** | Role saved, user gains Manager Panel access in sidebar |
| **Actual** | Would fail with PostgreSQL check constraint violation |
| **Where** | `PATCH /rest/v1/profiles?id=eq.<uid>` body `{ "role": "manager" }` |

**Root cause:** `profiles_role_check` only permitted `['user', 'moderator', 'admin']`. The `manager` role was added to the application but the constraint was not updated.

**Fix applied:**
```sql
ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['user','manager','moderator','admin']));
```

---

### B3. Admin Users page displays managers incorrectly

| Field | Detail |
|---|---|
| **What I did** | Logged in as admin, opened Admin → Users tab, viewed a user with `role = 'manager'` |
| **Expected** | Row shows "Manager" label; role dropdown defaults to "manager" |
| **Actual** | Row showed "User" label; dropdown defaulted to "user" — admin could not tell a manager from a regular user |
| **Where** | `app/(app)/admin/page.tsx` — role→label mapping and `defaultValue` logic |

**Fix applied:** Added `'manager'` case to both the display label map and the `defaultValue` resolver in the role dropdown.

---

## 🟡 WRONG — Works but Behaves Incorrectly

### W1. Duplicate email signup silently proceeds to onboarding ✅ Fixed

| Field | Detail |
|---|---|
| **What I did** | `POST /auth/v1/signup` with an email address that already has a confirmed account |
| **Expected** | Error shown, user stays on the register page |
| **Actual** | HTTP 200 returned (Supabase intentionally returns 200 to prevent email enumeration). The register page `handleSubmit` only checks `if(error)` — no error means it redirects to `/privacy?from=onboarding`. The user lands on onboarding without a real session |
| **Where** | `app/(auth)/register/page.tsx` — post-signup navigation logic |

**How to detect it:** Supabase returns `identities: []` on the duplicate-email response (a genuine new user has `identities: [{ ... }]`). Check this field before navigating.

**Recommended fix:**
```typescript
if (!error && data.user?.identities?.length === 0) {
  setError("If this email is registered, check your inbox for a confirmation link.");
  return;
}
```

**Fix applied:** Checks `data.user?.identities?.length === 0` after signup. If true, renders a neutral blue notice — "If an account with this email already exists, check your inbox to continue signing in." — with a "Sign in instead →" link. Does not navigate to onboarding. Email confirmation remains enabled.

---

### W2. Empty chat messages accepted by the database ✅ Fixed

| Field | Detail |
|---|---|
| **What I did** | `POST /rest/v1/chat_messages` with `{ "message": "" }` |
| **Expected** | Blocked — empty messages should not be stored |
| **Actual** | HTTP 200, empty string stored and displayed in chat |
| **Where** | `public.chat_messages` — missing `CHECK` constraint |

**Fix recommended:**
```sql
ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_nonempty
  CHECK (length(trim(message)) > 0);
```
The frontend also has no client-side guard (`message.trim()` check in `sendMessage` only prevents the button being clickable — a direct API call bypasses it).

---

### W3. Empty username can be set — breaks display ✅ Fixed

| Field | Detail |
|---|---|
| **What I did** | `PATCH /rest/v1/profiles?id=eq.<own-id>` with `{ "username": "" }` |
| **Expected** | Blocked by database constraint |
| **Actual** | Accepted — username stored as empty string. Sidebar, leaderboard, and profile page all display a blank name |
| **Where** | `public.profiles` — missing `CHECK` constraint |

**Fix applied:**
```sql
ALTER TABLE profiles
  ADD CONSTRAINT profiles_username_nonempty
  CHECK (length(trim(username)) > 0);
```

---

### W4. Password reset rate-limited with no user-friendly message

| Field | Detail |
|---|---|
| **What I did** | Triggered `POST /auth/v1/recover` twice for the same email within a short window |
| **Expected** | Informative message: "You can only request a reset once per hour" |
| **Actual** | Supabase returns `{ "msg": "email rate limit exceeded" }` — the reset page shows no error message at all (the error is not handled in the register/login UI) |
| **Where** | `app/(auth)/login/page.tsx` — no handling for the `email rate limit exceeded` error code |

**Recommended fix:** Map `error_code === "over_email_send_rate_limit"` or `msg.includes("rate limit")` to a friendly message in the password reset handler.

---

### W5. Blocked writes return HTTP 200 with empty body (no feedback to frontend) ✅ Fixed

| Field | Detail |
|---|---|
| **What I did** | Regular user attempted to PATCH another user's profile or update match status |
| **Expected** | HTTP 403 Forbidden with an error message |
| **Actual** | HTTP 200 with empty body — RLS correctly blocked the write (0 rows affected), but PostgREST does not distinguish "updated 0 rows due to RLS" from "updated 0 rows because no record matched" |
| **Where** | All `PATCH` endpoints protected by RLS (`/rest/v1/profiles`, `/rest/v1/matches`, `/rest/v1/players`) |

**Impact:** The frontend has no way to know whether a PATCH was successful or silently ignored. Currently no PATCH in the app checks the row count of the response, so a failed update would appear successful to the user.

**Recommended fix:** Use `Prefer: return=representation` on all critical PATCHes (profile save, team save) and check if the returned array is non-empty. If empty, show an error.

---

## 🟢 PASSING — All Confirmed Correct

### Authentication

| Test | Result | Notes |
|---|---|---|
| Valid login → token returned | ✅ PASS | `access_token` and `refresh_token` present |
| Wrong password → 400 | ✅ PASS | No credential detail leaked |
| Non-existent email → 400 | ✅ PASS | Same response as wrong password (no enumeration) |
| Admin password reset → old password rejected | ✅ PASS | Token rotation works correctly |
| Reset for non-existent email → 200 | ✅ PASS | No email enumeration |

### Role-Based Access Control

| Test | Result | Notes |
|---|---|---|
| Regular user reads own profile | ✅ PASS | Returns correct data |
| Regular user PATCHes own profile | ✅ PASS | Allowed |
| Regular user PATCHes another user's profile | ✅ PASS | RLS blocks — 0 rows changed |
| Regular user inserts `player_match_stats` | ✅ PASS | 403 Forbidden |
| Regular user changes match status | ✅ PASS | RLS blocks — 0 rows changed |
| Regular user reads another user's notifications | ✅ PASS | 0 rows returned |
| Regular user sets player injury status | ✅ PASS | RLS blocks — 0 rows changed |
| Regular user inserts a poll | ✅ PASS | 403 Forbidden |
| Unauthenticated PATCH to profiles | ✅ PASS | RLS blocks — 0 rows changed |

### Core User Flows

| Test | Result | Notes |
|---|---|---|
| Create fantasy team | ✅ PASS | Team row created correctly |
| Buy a player (add to squad) | ✅ PASS | `fantasy_team_players` row inserted |
| Buy same player twice | ✅ PASS | Unique constraint blocks duplicate |
| Sell player (remove from squad) | ✅ PASS | Row deleted |
| Send a chat message | ✅ PASS | Message stored and retrievable |
| Delete own chat message | ✅ PASS | Row deleted |
| Delete another user's message | ✅ PASS | RLS blocks |
| First poll vote | ✅ PASS | Vote recorded, count incremented atomically |
| Duplicate poll vote | ✅ PASS | `cast_poll_vote` returns `ok: false, error: "already voted"` |
| Join public league | ✅ PASS | `league_members` row inserted |

### Edge Cases

| Test | Result | Notes |
|---|---|---|
| Message exactly 500 chars | ✅ PASS | Accepted (at limit) |
| Message 501 chars | ✅ PASS | Check constraint blocks |
| Duplicate fantasy team (same user) | ✅ PASS | Unique `user_id` constraint blocks |
| Invalid UUID in query string | ✅ PASS | HTTP 400 returned, no crash |
| All-zeros UUID | ✅ PASS | 0 rows returned gracefully |

---

## Issues Fixed During Testing

| # | Description | File(s) Changed |
|---|---|---|
| B1 | Registration trigger missing `SET row_security = off` | `lib/supabase/fix_trigger.sql` (applied to DB) |
| B2 | `manager` role blocked by check constraint | Applied via SQL to Supabase |
| B3 | Manager displayed as "User" in admin panel | `app/(app)/admin/page.tsx` |
| W3 | Empty username accepted by DB | Applied check constraint via SQL to Supabase |

## Open Items — Decision Required

| # | Description | Decision Needed |
|---|---|---|
| ~~W1~~ | ~~Duplicate email signup navigates to onboarding~~ | Fixed — detects `identities.length === 0`, shows neutral notice, stays on register page |
| ~~W2~~ | ~~Empty chat messages accepted~~ | Fixed — `CHECK (length(trim(message)) > 0)` applied to DB |
| ~~W5~~ | ~~Blocked PATCHes return 200 with empty body~~ | Fixed — profile save and team save now verify row count; surface error if 0 rows updated |

---

*Generated by automated end-to-end API testing against production Supabase instance.*
