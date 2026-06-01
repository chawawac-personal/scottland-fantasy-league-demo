# Scottland Fantasy League — Testing Reference

## Supabase Setup — Complete

### Infrastructure

| Step | Result |
|---|---|
| **OMNI Care SaaS paused** | Freed up an active project slot |
| **Organisation created** | "Scottland FC" (`vxhxtbtmiiunwgblbrkg`) |
| **Project created** | `scottland-fantasy-league` · Region: `eu-west-2` · Status: `ACTIVE_HEALTHY` |
| **Project URL** | `https://hinnvqadajjmoouvsuad.supabase.co` |
| **`.env.local`** | Updated with real URL, anon key, and service role key |

### Database Seeded

| Table | Records |
|---|---|
| `players` | 18 Scottland FC players with full stats |
| `matches` | 6 fixtures (3 scheduled, 3 finished) |
| `profiles` | 6 demo managers |
| `leagues` | 3 leagues (1 public Zimbabwe league, 2 private) |
| `league_members` | 11 memberships |
| `achievements` | 8 badges unlocked across managers |
| `notifications` | 6 seeded notifications |
| `polls` | 2 Man of the Match polls |

### Demo Accounts (`@scottland.demo`)

| Email | Password | Role |
|---|---|---|
| `sfcmaster@scottland.demo` | `SFC@Demo2026!` | Top manager (Rank #1, 3421pts) |
| `zimwarrior@scottland.demo` | `SFC@Demo2026!` | Rank #2, 3398pts |
| `tendaifc@scottland.demo` | `SFC@Demo2026!` | Rank #3, 3387pts |
| `bulawayoboss@scottland.demo` | `SFC@Demo2026!` | Rank #4 |
| `harareguru@scottland.demo` | `SFC@Demo2026!` | Rank #5 |
| `admin@scottland.demo` | `SFC@Admin2026!` | Level 10 admin |

Run `npm run dev` in `d:\SFC` to start the app — it is now fully wired to the live Supabase project.
