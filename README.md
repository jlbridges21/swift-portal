# Swift Portal

Professional client portal for **Swift Aerial Media**. Built exclusively for Swift Aerial Media and its clients — not a white-label or multi-tenant SaaS.

## Features

### For Clients
- Request projects via public form
- View project status with visual timeline
- Browse photo galleries with fullscreen viewer
- Stream and download videos
- Access 360° virtual tours (Kuula integration)
- Download deliverables (PDF, ZIP)
- Pay invoices via Stripe
- Request revisions

### For Swift Aerial Media (Admin)
- Dashboard with key metrics
- Lead capture and management
- Client management with portal invites
- Project lifecycle management
- Media upload (photos, videos, documents)
- 360° tour organization
- Stripe payment link generation
- Activity logging

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI:** Shadcn-style components
- **Auth:** Supabase Auth
- **Database:** Supabase PostgreSQL
- **Storage:** Supabase Storage
- **Payments:** Stripe
- **Hosting:** Vercel

## File Structure

```
swift-portal/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Public homepage
│   │   ├── request/page.tsx            # Request a shoot form
│   │   ├── login/page.tsx              # Client login
│   │   ├── dashboard/
│   │   │   ├── page.tsx                # Client dashboard
│   │   │   └── projects/[id]/page.tsx  # Client project view
│   │   ├── admin/
│   │   │   ├── page.tsx                # Admin dashboard
│   │   │   ├── leads/page.tsx          # Lead management
│   │   │   ├── clients/                # Client management
│   │   │   └── projects/               # Project management
│   │   └── api/
│   │       ├── leads/                  # Lead submission
│   │       ├── clients/                # Client CRUD
│   │       ├── projects/               # Project CRUD
│   │       ├── media/                  # File upload/download
│   │       ├── tours/                  # 360 tour management
│   │       ├── payments/               # Stripe payment links
│   │       ├── revisions/              # Revision requests
│   │       ├── stripe/webhook/         # Stripe webhooks
│   │       └── auth/signout/           # Sign out
│   ├── components/
│   │   ├── ui/                         # Base UI components
│   │   ├── layout/                     # Header, Footer
│   │   ├── projects/                   # Project-specific components
│   │   └── admin/                      # Admin-specific components
│   ├── lib/
│   │   ├── supabase/                   # Supabase clients
│   │   ├── auth.ts                     # Auth helpers
│   │   ├── stripe.ts                   # Stripe client
│   │   ├── types.ts                    # TypeScript types
│   │   ├── constants.ts                # App constants
│   │   └── utils.ts                    # Utility functions
│   └── middleware.ts                   # Auth middleware
├── supabase/
│   └── schema.sql                      # Full database schema
├── .env.example
└── README.md
```

## Database Schema

Tables: `profiles`, `clients`, `leads`, `projects`, `media_assets`, `tours`, `payments`, `revisions`, `activity_logs`

See `supabase/schema.sql` for the complete schema including:
- Custom ENUM types
- Foreign keys and indexes
- Row Level Security policies
- Storage bucket configuration
- Auto-profile creation trigger

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_APP_URL` | App URL (http://localhost:3000 for dev) |

## Supabase Setup

### 1. Create Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and API keys from Settings → API

### 2. Run Database Schema
1. Open the SQL Editor in your Supabase dashboard
2. Paste the contents of `supabase/schema.sql`
3. Run the query

### 3. Run v2 Migration (required for improvements)
Run `supabase/migration-v2.sql` in the SQL Editor. This adds:
- Asset display ordering
- YouTube video support
- Cover image selection
- Larger storage bucket limits (2GB media)

### 4. Fix Auth User Creation (if needed)
If creating or inviting users fails in Supabase Auth, run `supabase/fix-auth-trigger.sql` in the SQL Editor. This fixes the profile trigger and RLS permissions.

### 4. Create Admin User
After running the schema, create your first admin user:

```sql
-- Create admin user via Supabase Auth dashboard, then:
UPDATE profiles SET role = 'admin' WHERE email = 'your-admin@email.com';
```

Or create via Supabase Auth → Users → Add User, then update the profile role.

### 4. Storage Buckets
The schema automatically creates:
- `project-media` — Photos (JPG, PNG, WEBP) and Videos (MP4, MOV), max 500MB
- `project-documents` — PDF and ZIP files, max 100MB

## Stripe Setup

### 1. Create Stripe Account
1. Go to [stripe.com](https://stripe.com) and create an account
2. Get your API keys from Developers → API keys

### 2. Configure Webhook
1. Go to Developers → Webhooks → Add endpoint
2. URL: `https://your-domain.com/api/stripe/webhook`
3. Events: `checkout.session.completed`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

For local development, use the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Fill in your Supabase and Stripe credentials

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Vercel Deployment

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial Swift Portal setup"
git remote add origin https://github.com/your-org/swift-portal.git
git push -u origin main
```

### 2. Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and import your repository
2. Framework preset: **Next.js**
3. Add all environment variables from `.env.example`
4. Set `NEXT_PUBLIC_APP_URL` to your Vercel domain (e.g., `https://swift-portal.vercel.app`)
5. Deploy

### 3. Post-Deployment
1. Update Stripe webhook URL to your production domain
2. Update Supabase Auth redirect URLs in Authentication → URL Configuration:
   - Site URL: `https://your-domain.com`
   - Redirect URLs: `https://your-domain.com/**`

## Admin Workflow

1. **Lead comes in** → View in Admin → Leads
2. **Create client** → Admin → Clients → New Client (optionally set portal password)
3. **Create project** → Admin → Projects → New Project
4. **Upload media** → Open project → Upload photos, videos, documents
5. **Add 360 tours** → Open project → Add Tour (Kuula URL)
6. **Create payment** → Open project → Create Payment Link
7. **Mark delivered** → Update project status to "Delivered"

## Client Workflow

1. **Receive portal invite** → Admin creates client with password
2. **Login** → Client Login at `/login`
3. **View projects** → Dashboard shows active and delivered projects
4. **Pay invoice** → Click "Pay Now" on outstanding invoices
5. **Download media** → Open project → Browse gallery, download files
6. **Access 360 tour** → Open project → Open Tour / Copy Link
7. **Request revision** → Open project → Request a Revision

## Project Statuses

| Status | Description |
|--------|-------------|
| Lead Received | Initial inquiry received |
| Scheduled | Shoot date confirmed |
| Shot Complete | Aerial capture finished |
| Editing | Post-production in progress |
| Ready For Review | Client can review deliverables |
| Awaiting Payment | Invoice sent, payment pending |
| Delivered | Project complete |

## License

Proprietary — Swift Aerial Media. All rights reserved.
