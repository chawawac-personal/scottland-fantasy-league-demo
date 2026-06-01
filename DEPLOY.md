# Deployment Checklist
**Scottland Fantasy League — OMNI Global**

Complete every item before sharing the app with real users.

---

## 1. Update `NEXT_PUBLIC_SITE_URL` in `.env.local`

This URL is embedded in every confirmation email Supabase sends.
If it points to `localhost`, real users click a broken link.

```env
# .env.local
NEXT_PUBLIC_SITE_URL=https://your-production-domain.com
```

---

## 2. Update Site URL in the Supabase Dashboard

1. Go to **Supabase Dashboard → Authentication → URL Configuration**
2. Set **Site URL** to your production domain (e.g. `https://your-production-domain.com`)
3. Add your production domain to **Redirect URLs**:
   ```
   https://your-production-domain.com/auth/callback
   ```
4. Save.

> Without this, Supabase rejects the auth callback from your production domain.

---

## 3. Configure a Custom SMTP Provider (Supabase free tier limit)

Supabase free tier caps auth emails at **4 per hour**.
This blocks registration as soon as more than 4 users try to sign up in the same hour.

1. Go to **Supabase Dashboard → Authentication → SMTP Settings**
2. Enable **Custom SMTP**
3. Enter your SMTP credentials (Resend, SendGrid, Mailgun, or any SMTP provider)
4. Set **Sender name** to `Scottland Fantasy League` and **Sender email** to a verified address

> Recommended: [Resend](https://resend.com) — free tier includes 3,000 emails/month and works with Supabase in minutes.

---

## 4. Customise the Confirmation Email Template

1. Go to **Supabase Dashboard → Authentication → Email Templates**
2. Edit the **Confirm signup** template to match your brand:

```html
<h2>Welcome to Scottland Fantasy League</h2>
<p>Click the button below to confirm your email and start playing.</p>
<a href="{{ .ConfirmationURL }}">Confirm your email</a>
<p>If you didn't create an account, you can safely ignore this email.</p>
<p>— The Scottland Fantasy League Team, powered by OMNI Global</p>
```

---

## 5. Remove or replace seed users before launch

The existing test users (`SFCMaster99`, `ZimWarrior`, etc.) use fake `@scottland.demo`
email addresses and seeded points. They are not real players.

**Options:**
- Delete them via **Supabase Dashboard → Authentication → Users** before launch
- Keep them as demonstration accounts (points leaderboard will show them)
- Reset their `fantasy_points` to 0 so the leaderboard starts clean

---

## 6. Verify the registration flow end-to-end

Before sharing with users, test the full flow with a real email address:

1. Go to `/register`
2. Enter real details with a real email (e.g. Gmail)
3. Check inbox — confirmation email should arrive from your SMTP sender
4. Click the confirmation link → should land on `/onboarding` (not `/dashboard`)
5. Complete onboarding → should land on `/dashboard`
6. Log out and log back in → should go straight to `/dashboard`

---

## 7. Set the admin account password

The `SFCAdmin` account was created with a temporary password.
Update it before launch via **Supabase Dashboard → Authentication → Users → SFCAdmin → Reset password**.

---

## Current status

| Item | Status |
|---|---|
| Registration trigger fixed (RLS bypass) | ✅ Done |
| Auth callback routes to onboarding for new users | ✅ Done |
| Duplicate email handled gracefully on register page | ✅ Done |
| Manager role constraint includes `manager` | ✅ Done |
| Empty username and empty message DB constraints | ✅ Done |
| `NEXT_PUBLIC_SITE_URL` updated for production | ⏳ You need to do this |
| Supabase Site URL + Redirect URLs set | ⏳ You need to do this |
| Custom SMTP configured | ⏳ You need to do this |
| Confirmation email template customised | ⏳ You need to do this |
| Seed users removed or reset | ⏳ Your decision |
| Admin password set | ⏳ You need to do this |
