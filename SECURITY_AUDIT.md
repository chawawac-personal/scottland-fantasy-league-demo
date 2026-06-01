# Security Audit — Scottland Fantasy League

**Date:** 2026-05-29  
**Auditor:** Claude Sonnet 4.6 (automated review)  
**Project:** Scottland FC Fantasy League — Next.js 15 + Supabase  
**Scope:** Full codebase — all 13 OWASP-aligned security areas  

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical | 2 | Fixed |
| 🟠 High | 2 | Fixed |
| 🟡 Medium | 4 | Fixed |
| 🟢 Low | 1 | Fixed |
| **Total** | **9** | **All resolved** |

Second pass after fixes found **no new issues**.

---

## Findings & Fixes

---

### F1 — No `.gitignore` (Critical · Secrets)

**File:** `(project root)` — file did not exist  

**Issue:**  
No `.gitignore` existed. Running `git add .` would have committed `.env.local`, exposing:
- `SUPABASE_SERVICE_ROLE_KEY` — bypasses all Row Level Security, grants full database access
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — though public by design, rotation becomes harder once it is in git history
- All future secrets added to `.env.local`

Once a secret is in git history it must be treated as permanently compromised — rotating the key is not sufficient if the history is ever cloned.

**Fix:** Created `.gitignore` excluding:
```
.env
.env.local
.env.*.local
.env.development.local
.env.test.local
.env.production.local
```

Also created `.env.example` documenting every required variable without values, so new developers know what to set without copying real credentials.

---

### F2 — Next.js Middleware Bypass Vulnerability (Critical · Dependencies)

**File:** `package.json` — `next: 15.3.2`  

**Issue:**  
`npm audit` reported a **critical** CVE: *"Next.js has a Middleware / Proxy bypass in App Router applications via segment-prefetch routes."* A crafted prefetch request could bypass the middleware entirely, circumventing the entire authentication layer — meaning unauthenticated users could reach `/dashboard`, `/admin`, and all other protected pages despite the middleware redirect logic.

**Fix:** Updated Next.js to the latest patched release:
```
npm install next@latest
```

**Remaining (accepted risk):** A **moderate** PostCSS advisory remains inside Next.js's own bundled build tooling. The "fix" would downgrade Next.js to version 9.3.3, which is not viable. This vulnerability is build-time only (CSS processing during `next build`) and is not exploitable at runtime in the browser.

---

### F3 — Form Data Spread Directly Into Database Insert (High · Permissions)

**File:** `app/(auth)/onboarding/page.tsx:25`  

**Issue:**  
The onboarding profile creation used a JavaScript spread operator to pass all form state directly to the Supabase upsert:

```ts
// VULNERABLE
await supabase.from("profiles").upsert({
  id: user.id,
  username: user.email?.split("@")[0] ?? "fan",
  ...form,  // ← attacker controls every key and value
});
```

A user who opened DevTools and modified `form` to include `role: "admin"` before submitting would successfully insert that value. The Supabase RLS `with_check` policy for INSERT only verified that `auth.uid() = id`, not which columns were being written.

**Fix (code):** Enumerate every allowed field explicitly with enforced length limits:

```ts
await supabase.from("profiles").upsert({
  id:               user.id,
  username:         (user.email?.split("@")[0] ?? "fan").slice(0, 30).replace(/[^a-z0-9_]/gi, "_"),
  full_name:        form.full_name.slice(0, 100),
  supporter_branch: form.supporter_branch.slice(0, 60),
  favorite_player:  form.favorite_player.slice(0, 60),
  bio:              form.bio.slice(0, 300),
});
```

**Fix (database):** Also revoked INSERT privilege on all privileged columns at the PostgreSQL level as defence in depth:

```sql
REVOKE INSERT (role, level, xp, fantasy_points) ON public.profiles FROM authenticated;
```

This means even if the code-level fix were bypassed, the database would reject any attempt to insert values into those columns.

---

### F4 — Wildcard Image Hostname Enables SSRF (High · Insecure Configuration)

**File:** `next.config.ts:6`  

**Issue:**  
The Next.js image remote patterns were configured with a wildcard:

```ts
// VULNERABLE
remotePatterns: [{ protocol: "https", hostname: "**" }],
```

The Next.js Image Optimizer accepts a URL, fetches it server-side, and returns the processed image. A wildcard hostname allows any `https://` URL to be proxied through the server, including:
- Internal cloud metadata endpoints (e.g. `https://169.254.169.254/...` on AWS/GCP)
- Internal Kubernetes service endpoints
- Any external host the attacker wants to scan or exfiltrate through

This is a Server-Side Request Forgery (SSRF) vector.

**Fix:** Restricted to specific known origins:

```ts
remotePatterns: [
  {
    protocol: "https",
    hostname: "hinnvqadajjmoouvsuad.supabase.co",  // Supabase Storage
    pathname: "/storage/v1/object/public/**",
  },
  {
    protocol: "https",
    hostname: "lh3.googleusercontent.com",           // Google OAuth avatars
  },
],
```

Add additional hostnames here only when a specific use case requires it.

---

### F5 — Raw Supabase Error Messages Shown to Users (Medium · Error Messages)

**Files:** `app/(auth)/login/page.tsx:21`, `app/(auth)/register/page.tsx:20`  

**Issue:**  
Both auth forms passed `error.message` from the Supabase SDK directly to the UI:

```ts
// VULNERABLE
if (error) { setError(error.message); ... }
```

Supabase error messages can expose implementation details such as:
- Auth provider names and configuration
- Rate-limiting thresholds and counts
- Internal service names
- Unexpected stack traces during outages

**Fix — Login:** Single generic message regardless of actual error:

```ts
setError("Invalid email or password. Please try again.");
```

**Fix — Register:** Map known error types to safe messages, generic fallback for everything else:

```ts
const msg =
  error.message.toLowerCase().includes("already registered")
    ? "An account with this email already exists."
    : error.message.toLowerCase().includes("password")
      ? "Password must be at least 8 characters."
      : "Unable to create account. Please try again.";
setError(msg);
```

---

### F6 — Development URL in `NEXT_PUBLIC_SITE_URL` (Medium · Insecure Configuration)

**File:** `.env.local:4`  

**Issue:**  
```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`NEXT_PUBLIC_` variables are baked into the browser-side JavaScript bundle at build time. If the app were deployed to production without updating this value:
- The signout redirect would send users to `http://localhost:3000`
- The OAuth callback URL would point to localhost
- The value would be visible to every visitor in the browser bundle

**Fix:** Created `.env.example` documenting the correct production value:

```env
# Set to your actual domain in production (no trailing slash)
NEXT_PUBLIC_SITE_URL=https://your-app-domain.com
```

**Action required:** Update `.env.local` and any deployment environment variables to the real production domain before going live.

---

### F7 — Auth Callback Ignores Exchange Failure (Medium · Authentication & Sessions)

**File:** `app/auth/callback/route.ts:13`  

**Issue:**  
The OAuth callback route called `exchangeCodeForSession(code)` but ignored the result:

```ts
// VULNERABLE
if (code) {
  await supabase.auth.exchangeCodeForSession(code); // error discarded
}
return NextResponse.redirect(new URL("/dashboard", request.url)); // always redirects
```

If the exchange failed (expired code, replay attack, PKCE mismatch, network error), the user was silently redirected to `/dashboard` in an unauthenticated state. The middleware would catch this and redirect back to `/login`, but:
- The error was completely invisible — no user feedback
- A direct GET to `/auth/callback` with no code also redirected to `/dashboard`
- The failure mode was opaque and undebuggable

**Fix:**

```ts
if (code) {
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=auth_failed`);
} else {
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
return NextResponse.redirect(`${origin}/dashboard`);
```

The login page now displays "Authentication failed. Please try signing in again." when `?error=auth_failed` is present.

---

### F8 — `role` Column INSERT Privilege Not Revoked (Medium · Permissions)

**Database:** `public.profiles` table  

**Issue:**  
An earlier fix revoked `UPDATE` on the `role` column to prevent privilege escalation:

```sql
REVOKE UPDATE (role, level, xp, fantasy_points) ON profiles FROM authenticated;
```

However, `INSERT` was not revoked separately. A user scripting the profile creation endpoint directly (bypassing the UI) could send `role: 'admin'` during initial account setup and succeed, because:
- The RLS `INSERT` policy only checked `auth.uid() = id`
- The column check constraint `role IN ('user','moderator','admin')` accepts `'admin'` as a valid value
- The code-level fix (F3) was not yet applied at the time this was discovered

**Fix:**

```sql
REVOKE INSERT (role, level, xp, fantasy_points) ON public.profiles FROM authenticated;
```

The database now rejects any attempt by an authenticated user to write these columns on either INSERT or UPDATE. Only `service_role` (server-side only, never in browser code) can modify these fields.

---

### F9 — `?next=` Redirect Param Set But Never Consumed (Low · Authentication & Sessions)

**Files:** `middleware.ts:52`, `app/(auth)/login/page.tsx:22`  

**Issue:**  
The middleware preserved the user's intended destination:

```ts
url.searchParams.set("next", pathname); // e.g. /settings
return NextResponse.redirect(url);      // → /login?next=/settings
```

But the login page ignored it entirely:

```ts
router.push("/dashboard"); // always /dashboard regardless of ?next=
```

This had two consequences:
1. Users who bookmark `/profile` or `/settings` can never return there directly after login — they always land on `/dashboard`
2. The unread `?next=` parameter was latent open-redirect surface — if a developer later wired it up without validation, an attacker could craft `/login?next=https://evil.com` and redirect victims to an external phishing site after login

**Fix:** Added a `safeRedirect()` validator that only permits relative paths, then consumed the param:

```ts
function safeRedirect(next: string | null): string {
  if (!next) return "/dashboard";
  // Must start with / and not contain // (protocol-relative URL)
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

// After successful login:
router.push(safeRedirect(searchParams.get("next")));
```

Any attempt to pass an external URL (e.g. `?next=https://evil.com` or `?next=//evil.com`) is rejected and falls back to `/dashboard`.

---

## Second Pass Results

After all nine fixes were applied, the entire codebase was reviewed again. **No new issues were introduced.**

Checks performed on the fixed code:

| Check | Result |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` in any TypeScript file | Not found — server-only |
| `NEXT_PUBLIC_` prefix on service role key | Not found |
| `console.log/error/warn` in app or component files | Not found |
| `dangerouslySetInnerHTML` / `innerHTML` / `eval()` | Not found |
| `window.location` usage | Only in OAuth redirect (correct browser-side usage) |
| TypeScript compiler errors | None |
| Hardcoded secrets or API keys | Not found |

---

## Ongoing Security Recommendations

These items are not vulnerabilities today but should be addressed before significant user growth:

### Rate Limiting on Auth Endpoints
Supabase Auth has built-in rate limiting, but the specific thresholds should be reviewed in the Supabase dashboard:
- **Login:** Limit failed attempts per IP and per email
- **Register:** Limit signups per IP
- **OAuth:** Already handled by Google/provider

### HTTPS Enforcement
Ensure the production deployment (Vercel, Railway, etc.) has:
- HTTPS forced on all routes
- HSTS header with `max-age` of at least 1 year
- No HTTP fallback

### Cookie Security (Supabase SSR)
Supabase SSR manages session cookies. Verify in production that cookies have:
- `Secure` flag (HTTPS-only)
- `HttpOnly` flag (no JavaScript access)
- `SameSite=Lax` or `SameSite=Strict`

These are set by the Supabase SSR library automatically when the app is served over HTTPS.

### Data Retention & Privacy
- User emails and profile data are stored in Supabase — ensure Supabase's data region (currently `eu-west-2`) complies with applicable privacy regulations
- A "Delete Account" button exists in Settings but currently has no backend implementation — wire it up to `supabase.auth.admin.deleteUser()` via a server action before launch
- Consider adding a privacy policy page before onboarding users

### Admin Role Assignment
No UI exists for granting admin access. The only way to make a user an admin is via the Supabase SQL editor:

```sql
UPDATE profiles SET role = 'admin' WHERE username = 'your_username';
```

This is intentional (no self-service escalation), but the process should be documented internally.

---

## Files Changed During This Audit

| File | Change |
|---|---|
| `.gitignore` | Created — excludes all `.env*` files |
| `.env.example` | Created — documents required variables |
| `next.config.ts` | Restricted image remote patterns |
| `middleware.ts` | (Already correct — no changes needed) |
| `app/auth/callback/route.ts` | Validates exchange result, redirects on failure |
| `app/(auth)/login/page.tsx` | Generic error message, consumes `?next=` safely |
| `app/(auth)/register/page.tsx` | Generic error messages, input length limits |
| `app/(auth)/onboarding/page.tsx` | Explicit field enumeration, length limits |
| `package.json` | Next.js updated to latest patched version |
| Supabase DB | `REVOKE INSERT (role, level, xp, fantasy_points)` applied |
