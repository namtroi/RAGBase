# Phase 6: Multi-tenant SaaS + Supabase Auth + Stripe

**Goal:** Production SaaS platform with Supabase authentication, Stripe billing, per-user Drive access, API keys, and data export.

**Prerequisites (from Phase 5):**
- ✅ Qdrant Hybrid Search (Dense + Sparse vectors)
- ✅ AES-256-GCM encryption for Drive OAuth tokens
- ✅ Outbox pattern for vector sync

---

## Scope

| Feature | Details |
|---------|---------|
| **User Management** | Supabase Auth (email/password, social OAuth ready) |
| **Authentication** | JWT tokens (issued by Supabase) |
| **Authorization** | Single role: **User** (full access to their own data) |
| **Multi-tenant** | Row-level isolation via `tenantId = Supabase user.id` |
| **Subscriptions** | Stripe integration (Free/Pro/Enterprise tiers) |
| **Drive OAuth** | Per-user Google Drive access (not service account) |
| **Database Access** | API-based only (no direct DB exposure) |
| **API Keys** | User-generated keys for programmatic access |
| **Data Export** | JSON archive export (GDPR compliance) |

---

## Architecture

### **Auth Flow**

1. User registers/logs in via Supabase Auth
2. Supabase issues JWT token
3. Frontend sends JWT in `Authorization: Bearer {token}` header
4. Backend verifies JWT with Supabase SDK
5. Extract `user.id` → becomes `tenantId`
6. All database queries filtered by `tenantId`

**Security:** Backend never stores passwords; Supabase handles all auth.

### **Data Access Pattern**

**API-based access only:**
- User Frontend → Backend REST API → PostgreSQL + Qdrant
- JWT verification middleware on all routes
- Quota check before resource-consuming operations
- Audit logging for analytics

**Why not direct DB access?**
- Security (no DB credentials exposed)
- Quota enforcement (impossible with direct access)
- Audit trail (track all operations)
- Caching layer (easy to add)

---

## Database Scaling Strategy

### **Phase 6A: Single DB (<10K users)**

**Approach:** Single PostgreSQL instance with tenant filtering

**Performance (1000 users):**
- Total data: ~1.3GB (100K docs, 500K chunks)
- Query latency: <50ms with proper indexes
- Vector search: 10-50ms (Qdrant)
- Connections: 50-100 concurrent

**Specs:**
- Instance: Supabase Pro or AWS RDS db.t4g.medium
- RAM: 4GB, Storage: 50GB SSD
- Cost: $50-100/month

**Required indexes:**
- `tenant_id` on all tables
- Composite: `(tenant_id, status)` for filtering

**Upgrade trigger:** Users >10K OR DB >100GB OR latency >200ms

---

### **Phase 6B: Sharding (10K-100K+ users)**

**Approach:** Hash-based horizontal sharding

**Strategy:**
- 10 shards initially (add more as needed)
- Shard selection: `hash(user.id) % shard_count`
- Each shard: ~10K users, ~10GB data
- Deterministic routing (same user always hits same shard)

**Benefits:**
- Query latency stays <50ms regardless of total users
- Horizontal scaling (add shards)
- Isolated performance between shards

**Cost (100K users):**

| Architecture | Instances | Cost/month |
|--------------|-----------|------------|
| Single DB | 1 | $500+ (degrading) |
| **Sharding (10)** | **10** | **$2K-5K** |
| DB per tenant | 100K | $500K+ ❌ |

---

## Pricing Tiers

### **Free Tier**
- Documents: 50/month, Storage: 500MB
- Drive: 1 folder, Formats: PDF/TXT/JSON/MD
- Queries: 100/day, Rate limit: 50 req/hour

### **Pro Tier ($19-29/month)**
- Documents: 1,000/month, Storage: 10GB
- Drive: 10 folders, Formats: All
- Queries: Unlimited, Rate limit: 500 req/hour
- Priority processing: 2x faster

### **Enterprise ($99-199/month)**
- Documents: Unlimited, Storage: 100GB+
- Drive: Unlimited, Formats: All + custom
- Queries: Unlimited, Rate limit: 5,000 req/hour
- Dedicated workers, SLA: 99.9%, Priority support

---

## Supabase Integration

### **User Metadata Storage**

Store subscription info in Supabase `user_metadata`:
- `subscription`: free/pro/enterprise
- `stripeCustomerId`: Stripe customer ID
- `stripeSubscriptionId`: Active subscription
- `subscriptionStatus`: active/canceled/past_due
- `quotas`: Object with limits (documents, storage, queries, folders)

**Benefits:** No user table in backend, single source of truth.

### **JWT Verification**

Backend verifies JWT using Supabase SDK:
- Extract token from `Authorization` header
- Call `supabase.auth.getUser(token)`
- Get user ID, email, and metadata
- Attach to request context for downstream use

---

## Stripe Subscription Integration

### **Upgrade Flow**

1. User clicks "Upgrade" in frontend
2. Backend creates Stripe Checkout Session
3. User redirects to Stripe payment page
4. User completes payment
5. Stripe sends webhook to Supabase Edge Function
6. Edge Function updates user metadata with new subscription

### **Webhook Handling**

**Events to handle:**
- `customer.subscription.created` → Set subscription tier
- `customer.subscription.updated` → Update tier/status
- `customer.subscription.deleted` → Downgrade to free
- `invoice.payment_failed` → Mark past_due

**Implementation:** Supabase Edge Function (Deno runtime)
- Verify Stripe webhook signature
- Update Supabase user metadata
- No backend involvement (serverless)

### **Customer Portal**

Stripe pre-built portal for:
- View invoices
- Update payment method
- Cancel subscription
- View billing history

**Backend creates portal link:** `stripe.billingPortal.sessions.create()`

---

## Quota Enforcement

### **Strategy:** Middleware check before every request

**Quotas tracked:**
- Documents uploaded this month
- Storage used (bytes)
- Queries today
- Drive folders synced

### **Enforcement points:**
- Upload: Check document count + storage
- Query: Check daily query count
- Drive sync: Check folder limit

### **Query logging:**
- Store query in `QueryLog` table
- Track per-user daily count
- Use for quota + analytics

---

## Database Schema (High-Level)

### **Existing models (add tenantId):**
- `Document`: Add `tenantId` index
- `Chunk`: Add `tenantId` (denormalized for fast filtering)
- `DriveConfig`: Add `tenantId` (per-user OAuth, tokens encrypted in Phase 5)

### **New models:**
- `ApiKey`: User-generated API keys (hashed)
- `QueryLog`: Query history for quota tracking

### **Indexing strategy:**
- Primary: `tenantId` on all tables
- Composite: `(tenantId, status)`, `(tenantId, createdAt)`

---

## API Endpoints

### **Documents**
- `POST /api/documents` - Upload (quota check)
- `GET /api/documents` - List (filtered by tenant)
- `GET /api/documents/:id` - Detail
- `DELETE /api/documents/:id` - Delete
- `GET /api/documents/:id/content` - Download processed

### **Drive Sync**
- `POST /api/drive/authorize` - Start OAuth flow
- `GET /api/drive/callback` - OAuth callback
- `POST /api/drive/configs` - Add folder
- `GET /api/drive/configs` - List folders
- `POST /api/drive/sync/:id/trigger` - Manual sync

### **Search**
- `POST /api/query` - Semantic search (quota check)

### **Billing**
- `POST /api/billing/checkout` - Create Stripe session
- `GET /api/billing/portal` - Customer portal link
- `GET /api/billing/usage` - Usage stats

### **API Keys**
- `POST /api/keys` - Generate new key
- `GET /api/keys` - List user's keys
- `DELETE /api/keys/:id` - Revoke key

### **Export**
- `POST /api/export` - Request data export
- `GET /api/export/:id` - Check export status

---

## Google Drive OAuth

### **Per-User OAuth (not Service Account)**

**Why per-user:**
- Each user authorizes their own Drive
- Users control what folders to share
- Better security (no shared credentials)
- No credential rotation needed

**Flow:**
1. User clicks "Connect Google Drive"
2. Backend generates OAuth URL with `state=userId`
3. User authorizes on Google
4. Google redirects to callback with code
5. Backend exchanges code for tokens
6. Encrypt `refresh_token` (AES-256-GCM from Phase 5) and store in DriveConfig

**Scope:** `https://www.googleapis.com/auth/drive.readonly`

---

## API Key Management

### **Purpose**
Allow programmatic access from external apps (chatbots, mobile apps).

### **Features:**
- User creates keys from dashboard
- Each key has friendly name
- Show plaintext ONCE on creation
- Store bcrypt hash in DB
- Track last used timestamp
- Optional expiration date
- Revoke anytime

### **Authentication:**
Backend supports both:
- `Authorization: Bearer {jwt}` - Frontend/dashboard
- `Authorization: sk_xxx...` - External apps

### **Rate limiting per API key:**
- Free: 50 req/hour
- Pro: 500 req/hour
- Enterprise: 5000 req/hour

---

## Data Export

### **Purpose**
GDPR compliance, no vendor lock-in, user trust.

### **Export format:**

**JSON Archive (ZIP):**
- `documents.json` - Metadata + processed content
- `chunks.json` - All chunks with metadata
- `drive_configs.json` - Folder settings

### **Frequency limits:**
- Free: 1/month
- Pro: 1/week
- Enterprise: Unlimited

### **Workflow:**
1. User requests export → Job queued
2. Backend generates files asynchronously
3. Upload ZIP to S3 (presigned URL)
4. Email download link to user
5. Link expires after 7 days

### **Benefits:**
- GDPR Article 20 compliance (data portability)
- No vendor lock-in
- User backup option
- Compatible with other RAG systems

---

## Configuration

### **Environment Variables:**

**Supabase:**
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

**Stripe:**
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE`

**Google Drive OAuth:**
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`

**Data Export:**
- `EXPORT_S3_BUCKET`, `EXPORT_LINK_EXPIRY_DAYS`

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Supabase Auth** | No password handling, social OAuth ready |
| **Single User role** | Simplify for Phase 6, RBAC deferred |
| **Stripe billing** | Industry standard, pre-built portal |
| **Per-user Drive OAuth** | Better security than service account |
| **API-based access only** | Security + quota enforcement |
| **Row-level multi-tenancy** | Simple, scales to 10K users |
| **Sharding at 10K+** | Horizontal scaling, predictable latency |
| **bcrypt API keys** | Password-level security |
| **JSON export format** | Portable, human-readable |
| **Supabase Edge Functions** | Serverless webhooks, no backend overhead |

---

## Implementation Order

1. **Supabase setup** - Project, auth config
2. **JWT middleware** - Backend verification
3. **TenantId filtering** - Add to all queries
4. **Stripe integration** - Products, checkout, webhooks
5. **Quota enforcement** - Middleware
6. **Drive OAuth** - Replace service account (uses Phase 5 encryption)
7. **API Keys** - Generate, verify, revoke
8. **Data Export** - Async job, S3 upload

---

## Success Criteria

**Phase 6 complete when:**
- ✅ User registration/login via Supabase
- ✅ JWT verification on all routes
- ✅ Multi-tenant isolation (no cross-tenant access)
- ✅ Stripe subscription working (all 3 tiers)
- ✅ Quota enforcement functional
- ✅ Per-user Drive OAuth replacing service account
- ✅ API keys working for external apps
- ✅ Data export functional (GDPR ready)
- ✅ Zero regression in Phase 1-5 functionality
- ✅ Tests passing (unit + integration + E2E)

---

## Migration from Phase 5

**No migration needed** - Phase 1-5 for testing only.

**Production starts fresh:**
1. Create Supabase project
2. Configure Stripe products
3. Deploy backend with new environment
4. First user registers → first tenant
