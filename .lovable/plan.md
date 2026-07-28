# Hazel Ağaoğlu Nail Art Studio — Final Implementation Plan

## 1. Objective

Build a Turkish-language, mobile-first boutique nail-studio website with:

- A real online booking engine

- Live availability

- Secure appointment-management links

- A practical administration panel for Hazel

- Service, price, schedule, customer, content and gallery management

Primary goal:

Customers should understand services, prices and duration, see real availability and book without messaging Hazel to ask for an appointment.

The public website should feel like a modern boutique nail atelier.

The admin panel should feel like a fast daily business tool focused on today’s customers, the next appointment, schedule gaps and operational changes.

---

## 2. V1 Assumptions

- Turkish customer-facing copy

- Warm, young and elegant tone

- Single provider: Hazel

- Architecture remains extensible to multiple providers later

- Business timezone: `Europe/Istanbul`

- Store all absolute timestamps as `timestamptz`

- Customers do not create accounts

- No payment or deposit collection in v1

- No AI WhatsApp bot in v1

- No automatic customer email or WhatsApp notifications in v1

- WhatsApp deep links and manually copied private links are allowed

- Supabase Auth email is allowed for Hazel’s password recovery

- Unknown business details must remain clearly marked placeholders and editable from admin

- Development and preview environments must never contain real customer data

Successful public appointments are created directly as `confirmed`.

Do not use persisted `pending` appointments in v1.

---

## 3. Technology

Use:

- TanStack Start

- React 19

- Vite 7

- Tailwind CSS v4

- shadcn/ui

- TanStack Query

- Zod

- Lovable Cloud

- PostgreSQL

- Supabase Auth

- Supabase Storage

- Playwright

Rules:

- All mutations use `createServerFn` or an explicit bare server handler

- Admin browser code never communicates directly with Supabase

- Admin routes are lazy-loaded and absent from the initial public entry graph

- Route guards are UX only

- Every private server function independently authenticates and authorizes the caller

- All important business mutations execute through narrowly scoped database RPCs

- Do not create a generic arbitrary-table mutation endpoint

---

## 4. Environments, Secrets and Migrations

Use separate:

- Local

- Staging/preview

- Production

These environments must not share:

- Customer data

- Supabase Auth users

- Storage objects

- Secrets

- Service-role credentials

Server-only secrets:

- `BOOKING_TOKEN_HMAC_KEYS`

- `BOOKING_TOKEN_ACTIVE_KEY_VERSION`

- `RATE_LIMIT_HMAC_SECRET`

- Supabase service-role key

- Monitoring or integration credentials

Secrets must never appear in:

- `VITE_*`

- Client bundles

- Loader data

- Browser storage

- Database rows

- Logs

- Analytics

- Error reports

Fail closed when a required secret is missing.

Database rules:

- Every schema change uses an ordered SQL migration

- Seed data remains separate from structural migrations

- Regenerate TypeScript database types after schema changes

- Do not make undocumented dashboard-only schema or RLS changes

- Every migration must run successfully against a clean database

- Destructive migrations require:

  - A verified backup

  - Rollback instructions

  - Explicit approval

- Staging and preview environments must use `noindex`

---

## 5. Route Structure

### Public routes

- `/`

- `/hizmetler`

- `/hizmetler/$slug`

- `/calismalar`

- `/hakkimda`

- `/hijyen`

- `/sss`

- `/iletisim`

- `/randevu`

- `/gizlilik`

- `/kullanim-kosullari`

- `/randevu-ve-iptal-kosullari`

- `/cerez-tercihleri`

Provide dedicated states for:

- 404

- General error

- Unauthorized

- Appointment not found

- Expired or revoked link

- Maintenance

- Booking temporarily disabled

### Token exchange routes

Bare server handlers that render no React shell:

- `/randevu-basarili/$receiptToken`

- `/randevu-yonet/$managementToken`

### Tokenless appointment routes

- `/randevu-basarili`

- `/randevu-yonet`

### Pre-authentication admin routes

Outside `_authenticated`:

- `/admin/giris`

- `/admin/sifremi-unuttum`

- `/admin/auth/callback`

- `/admin/sifre-sifirla`

### Limited AAL1 routes

Available after password authentication but before MFA completion:

- `/admin/mfa`

- `/admin/mfa-dogrula`

### Protected admin routes

Under `src/routes/_authenticated/admin/*` and requiring AAL2:

- `/admin`

- `/admin/randevular`

- `/admin/takvim`

- `/admin/hizmetler`

- `/admin/musteriler`

- `/admin/musteriler/$id`

- `/admin/galeri`

- `/admin/yorumlar`

- `/admin/sss`

- `/admin/mesajlar`

- `/admin/ayarlar`

### Health endpoint

- `/api/public/health`

Return only safe application and database reachability status.

Never return:

- Package versions

- Database versions

- Table names

- Connection details

- User counts

- Stack traces

- Secrets

---

## 6. Public Website Structure

### Home

1. Header

2. Hero

3. Nearest available times

4. Featured services, maximum four

5. Selected portfolio

6. Four-step booking explainer

7. Hygiene and trust

8. About Hazel

9. Real testimonials, hidden when empty

10. Location and opening hours

11. FAQ

12. Final booking CTA

13. Footer

14. Sticky mobile booking CTA

Hero heading:

`Güzellik detaylarda saklı.`

Supporting text:

`Hizmetini seç, uygun saatini gör ve randevunu birkaç adımda oluştur.`

Primary CTA:

`Online Randevu Al`

Sticky mobile CTA:

`Uygun Saatleri Gör`

### Services

- Introduction

- Category filters

- Service cards

- Price type

- Estimated duration

- Who the service suits

- Preparation information

- Booking CTA

### Service detail

- Description

- Price and duration

- Related portfolio

- Suitability

- Preparation

- Aftercare

- Related FAQ

- Booking CTA with preselected service

### Portfolio

- Category filters

- Accessible editorial grid

- Accessible lightbox

- Lazy-loaded images

- Instagram CTA

### About and Hygiene

- Editorial text and real photography

- No unsupported health, sterilization or medical claims

### FAQ

- Search

- Category filtering

- Accessible accordion

### Contact

Booking remains the primary action.

Then show:

- Address

- Directions

- Opening hours

- Phone

- WhatsApp

- Instagram

- Short contact form

Load map embeds only after user interaction or the required consent state.

Always provide a normal directions link.

### Booking

Four steps:

1. Service

2. Date and time

3. Customer information

4. Summary and confirmation

---

## 7. Design System

Creative direction:

`Soft Editorial Nail Atelier`

Balance:

- 70% modern editorial

- 20% soft femininity

- 10% nail-art character

Avoid:

- Neon pink

- Black-and-gold salon clichés

- Heavy marble

- Excessive flowers, butterflies or glitter

- Childish bubble UI

- Generic template appearance

- Slow decorative animation

- Excessive carousel use

### Colors

- Warm Ivory `#FBF7F3`

- Porcelain `#FFFDFC`

- Hazel Mulberry `#6F394A`

- Deep Mulberry `#552936`

- Dusty Rose `#C98998`

- Blush Mist `#F3E6E7`

- Warm Taupe `#B8A79C`

- Espresso Ink `#2B2325`

- Muted Cocoa `#6F6366`

- Border `#E7DBD6`

- Success `#4F725E`

- Error `#B4474E`

- Disabled `#D8CFCC`

Create semantic OKLCH tokens while retaining the source hex values in documentation.

### Typography

- Cormorant Garamond for display headings

- Manrope for body, forms, controls and all admin UI

Self-host the required font subsets.

Do not rely on third-party runtime font requests.

### UI rules

- Radius range: 10–24px

- Shadow: `0 12px 40px rgba(43,35,37,.06)`

- Important controls: minimum 48px

- Sticky mobile CTA: minimum 52px

- Motion: 180–260ms

- Maximum entrance movement: 12px

- Maximum image hover scale: 1.02

- Respect `prefers-reduced-motion`

---

## 8. Components

### Shared

- Button

- Field

- Input

- Textarea

- Select

- Checkbox

- Card

- Container

- SectionHeading

- Badge

- Accordion

- Dialog

- BottomSheet

- Skeleton

- EmptyState

- Toast

- Lightbox

- SafeImage

- ErrorBoundary

- Pagination

- SearchField

### Public

- SiteHeader

- MobileMenu

- Footer

- StickyBookCta

- WhatsAppButton

- Hero

- NextAvailability

- ServiceCard

- GalleryGrid

- TestimonialList

- FaqAccordion

- MapConsentPlaceholder

- TrustRow

### Booking

- BookingStepper

- ServicePicker

- DayStrip

- MonthCalendar

- TimeSlotGrid

- CustomerForm

- BookingSummary

- ConflictAlert

- SuccessPanel

- CopyManageLink

- AddToCalendar

- ManageBookingPanel

- AppointmentStateNotice

### Admin

- AdminShell

- StatCard

- TodayTimeline

- AppointmentTable

- AppointmentDrawer

- DayWeekCalendar

- AvailabilityEditor

- ScheduleExceptionEditor

- ServiceForm

- CustomerTable

- GalleryUploader

- SettingsForm

- ConfirmDialog

- NotificationBell

- ContactMessageDrawer

- RegenerateManageLinkDialog

- MfaEnrollmentPanel

- ReauthenticationDialog

---

## 9. Database Schema Separation

Use two schemas.

### `public`

Contains:

- Public content tables

- Admin-readable business tables protected by RLS

- Explicit public read functions

- Explicit authenticated admin RPCs

- Explicit service-role server-entry RPCs

### `private`

Contains:

- Internal helper functions

- Idempotency records

- Rate-limit counters

- Appointment-access sessions

- Audit logs

- Internal admin notifications

- Maintenance helpers

Do not expose `private` through the Data API.

Do not leave internal helper functions in an exposed schema only because their grants are revoked.

---

## 10. Appointments

`public.appointments` must include:

- `id uuid primary key`, generated in the trusted server layer

- `customer_id`

- `service_id`

- Random human-readable `booking_code`

- `token_key_version`

- Receipt-token hash, expiry and revocation

- Management-token hash, version, expiry and revocation

- `row_version bigint not null default 0`

- Immutable service-name snapshot

- Immutable duration snapshot

- Immutable buffer snapshots

- Immutable price and price-type snapshots

- Currency

- `start_at`

- `end_at`

- `occupied_start_at`

- `occupied_end_at`

- Generated `occupied_range tstzrange`

- Status

- Source

- Customer note

- Admin note

- Cancellation reason and time

- Completion time

- Consent evidence

- Created and updated timestamps

Consent fields:

- `privacy_notice_version`

- `booking_terms_version`

- `consented_at`

- `consent_source`

- Optional `consent_ip_hmac`

V1 appointment statuses:

- `confirmed`

- `completed`

- `cancelled`

- `no_show`

Do not persist `pending` appointments.

Hard overlap protection:

`EXCLUDE USING gist (occupied_range WITH &&) WHERE (status = 'confirmed')`

Add constraints for:

- `start_at < end_at`

- `occupied_start_at <= start_at`

- `end_at <= occupied_end_at`

- Positive duration

- Non-negative buffers

- Non-negative price when present

- Three-character uppercase currency

- Non-negative token versions

- Valid token expiration

- Consistent cancellation fields

- Consistent completion fields

State transitions:

- `confirmed → confirmed`

- `confirmed → completed`

- `confirmed → cancelled`

- `confirmed → no_show`

Completed, cancelled and no-show are terminal states.

Correcting a terminal state requires a separate admin override RPC, recent reauthentication, an explicit reason and an audit entry.

---

## 11. Other Core Tables

### Customers

`public.customers`:

- Normalized unique `phone_e164`

- Optional email

- Private notes

- Created and updated timestamps

Public booking upsert must never overwrite private notes.

### Services

`[public.services](http://public.services)`:

- Name

- Slug

- Short description

- Full description

- Category

- Price

- Price type

- Duration

- Before and after buffers

- Cover image

- Active flag

- Bookable flag

- Display order

- Timestamps

Price types:

- `fixed`

- `starting_from`

- `quote_required`

Referenced services are soft-deactivated, not hard-deleted.

### Business hours

`[public.business](http://public.business)_hours`:

- One row per weekday in v1

- `UNIQUE(weekday)`

- Valid start and end times

- Open or closed status

### Schedule exceptions

`public.schedule_exceptions`:

- One row per local calendar date

- `UNIQUE(local_date)`

- Closed, special opening, shortened day or extended day

- Valid start and end values

- Optional reason

### Availability blocks

`public.availability_blocks`:

- Start

- End

- Type

- Reason

- Timestamps

Types:

- `break`

- `time_off`

- `manual_block`

- `maintenance`

Require `start_at < end_at`.

### Public content

- `gallery_items`

- `testimonials`

- `faq_items`

- `site_settings`

Use explicit active or published flags and display order.

### Contact messages

Store:

- Name

- Normalized phone

- Email

- Message

- Privacy-notice version

- `consented_at`

- Status

- IP HMAC

- User agent

- Handling information

Require at least one of phone or email.

---

## 12. Private Tables

### Idempotency

`private.idempotency_keys`:

- `scope`

- `key_hmac`

- Request fingerprint

- Result appointment ID

- Token-free result payload

- Result management-token version where relevant

- Created time

- Expiry

Use `UNIQUE(scope, key_hmac)`.

Do not expose an externally visible `in_progress` state.

The idempotency row and business mutation complete inside the same transaction.

Concurrent identical requests rely on the unique constraint:

- The second transaction waits

- If the first commits, the second reads and returns the stored result

- If the first rolls back, the second may continue

- A different fingerprint returns `422 idempotency_key_reuse`

If a private link was explicitly regenerated after the original result:

- An old booking idempotency retry must not recreate or reveal the new private link

- Return the safe booking result without the management URL

- Show that the original private link is no longer available

### Rate limits

`private.rate_limit_counters`:

- Bucket HMAC

- Scope

- Window

- Count

- Expiry

Use atomic upsert and database time.

### Appointment-access sessions

`private.appointment_access_sessions`:

- Session hash

- Appointment ID

- Scope

- Created time

- Last seen

- Sliding expiry

- Absolute expiry

- Revocation

Scopes:

- `receipt_read`

- `appointment_manage`

Initial lifetime:

- 30 minutes

Maximum absolute lifetime:

- 2 hours

Do not bind sessions strictly to IP address or user agent.

### Audit logs

`private.audit_logs`:

- Actor user ID

- Actor type

- Action

- Entity type

- Entity ID

- Safe metadata

- Request ID

- Created time

Never store:

- Raw tokens

- Passwords

- Full notes

- Secret headers

- Unnecessary customer PII

### Notifications

`private.admin_notifications`:

- Type

- Entity

- Title

- Body

- Read time

- Created time

---

## 13. Token Design and Key Rotation

Generate the appointment UUID before calling the booking RPC.

Derive tokens in the trusted server layer:

Receipt token:

`HMAC(versioned_key, "receipt:v1|" + appointment_id)`

Management token:

`HMAC(versioned_key, "manage:v1|" + appointment_id + "|" + management_token_version)`

Persist only:

- SHA-256 token hash

- Token key version

- Management-token version

Raw tokens may exist only:

- In server memory

- In the initial successful booking response

- In a valid idempotent retry when the stored token version is still current

- In an explicit admin link-regeneration response

Use a versioned HMAC key ring:

- New appointments use the active key version

- Old key versions remain available until their related tokens expire or are revoked

- Missing historical keys produce a controlled expired-link result

- Key rotation requires a tested runbook

- Do not delete historical keys prematurely

Back up active and historical HMAC keys separately from the database using encrypted restricted storage.

Test:

- Key backup

- Key restoration

- Rotation rollback

- Safe historical-key retirement

Booking code must:

- Be cryptographically random

- Exclude ambiguous characters

- Retry on uniqueness conflict

- Never authorize a lookup or mutation

---

## 14. Availability

For one service and a bounded date range:

1. Load normal weekly business hours

2. Apply a matching schedule exception

3. Subtract availability blocks

4. Subtract confirmed appointment occupied ranges

5. Generate candidates every 15 minutes

6. Apply service duration and buffers

7. Remove past times

8. Apply minimum booking notice

9. Apply maximum booking range

10. Return grouped slots and the next available day

Rules:

- Maximum public range: 60 days

- Never calculate an unbounded range

- One service per availability request

- Rate-limit availability scraping

- Cache only safe display availability

- Booking confirmation always recalculates inside the transaction

- Invalidate affected availability cache after booking or schedule changes

---

## 15. Schedule and Booking Concurrency

The GiST exclusion constraint protects appointments from other appointments.

It does not prevent a booking from racing with a schedule edit.

Use transaction-scoped advisory locks.

### Provider-wide schedule lock

Bookings and date-specific schedule mutations acquire a shared provider schedule lock.

Weekly business-hours or global booking-policy changes acquire an exclusive provider schedule lock.

### Provider and local-date lock

Acquire the same deterministic provider/date lock for:

- Public booking

- Admin booking

- Customer rescheduling

- Admin rescheduling

- Availability-block changes

- Schedule-exception changes

For cross-date rescheduling:

- Acquire the provider-wide lock first

- Calculate both local-date lock keys

- Acquire date locks in sorted deterministic order

For weekly business-hours changes:

- Acquire the provider-wide exclusive schedule lock

Document and test advisory-lock key generation.

Test for lock-key collisions.

Advisory locking supplements, never replaces, the exclusion constraint.

---

## 16. Booking Transaction

The server layer performs:

1. Zod validation

2. Normalization

3. Consent validation

4. Honeypot and timing checks

5. Trusted rate-limit bucket calculation

6. Appointment UUID generation

7. Token derivation and hashing

8. Idempotency HMAC generation

9. Canonical request fingerprint generation

Call one service-role-only booking RPC.

Inside one transaction:

1. Acquire provider-wide shared schedule lock

2. Acquire provider/date lock

3. Remove an expired same-key idempotency record

4. Insert or resolve the idempotency key

5. Validate the request fingerprint

6. Validate that the appointment UUID is unused

7. Lock and load the selected service

8. Validate active and bookable status

9. Load applicable schedule and policy

10. Recalculate availability

11. Safely upsert the customer

12. Snapshot service, duration, buffers and price

13. Persist consent evidence

14. Insert the confirmed appointment

15. Let the exclusion constraint enforce overlap safety

16. Insert admin notification

17. Insert audit record

18. Store the token-free idempotent result

19. Commit

Any failure rolls back all steps.

Map exclusion violation `23P01` to a safe Turkish conflict response with alternative slots.

---

## 17. Idempotent Mutations

Use idempotency for:

- Public booking

- Customer cancellation

- Customer rescheduling

- Admin appointment creation

- Admin rescheduling

- Link regeneration

- Other retry-sensitive mutations

The fingerprint includes all semantically relevant normalized values:

- Service

- Date and time

- Name

- Phone

- Email

- Note

- Consent version

- Policy version

- Mutation-specific expected row version

Exclude temporary anti-spam values.

Results:

- Same key and same fingerprint: return the original result

- Same key and different fingerprint: return `422 idempotency_key_reuse`

- Failed transaction: leave no idempotency record

- Expired row: treat as a fresh operation

---

## 18. Rescheduling, Cancellation and Link Regeneration

### Normal rescheduling

Normal rescheduling preserves the current management token and private link.

Require:

- Valid admin authentication or management session

- Confirmed appointment

- Applicable rescheduling deadline

- `expected_row_version`

- Provider-wide shared schedule lock

- Old and new date locks

- `FOR UPDATE` appointment lock

- Fresh availability calculation

Then atomically:

- Update start and end times

- Update occupied range

- Extend receipt and management expiration if appropriate

- Increment `row_version`

- Insert notification

- Insert audit entry

### Cancellation

Require:

- Valid admin authentication or management session

- Confirmed status

- Applicable cancellation deadline

- `expected_row_version`

Then atomically:

- Set cancellation fields

- Increment row version

- Revoke management token

- Revoke every active `appointment_manage` session

- Insert notification

- Insert audit entry

The receipt link may remain read-only until its normal expiry so the customer can view the cancelled state.

Repeated cancellation returns the existing cancelled result safely.

### Admin private-link regeneration

Provide an explicit action:

`Yeni özel randevu bağlantısı oluştur`

Require:

- AAL2 session

- Recent reauthentication

- Expected row version

- Explicit confirmation

Then:

1. Increment management-token version

2. Derive a new token and hash

3. Persist the new hash

4. Revoke the previous token

5. Revoke every active management session

6. Increment row version

7. Insert audit entry

8. Display the new link once

Warn that anyone possessing the private link can manage the appointment.

---

## 19. Token Exchange

Token exchange routes are bare GET server handlers.

Flow:

1. Apply trusted rate limiting

2. Hash the supplied token

3. Look up the appointment

4. Validate token key version, expiry and revocation

5. Return a generic failure for malformed, unknown, expired or revoked tokens where practical

6. Generate a cryptographically secure 32-byte access-session ID

7. Store only its SHA-256 hash

8. Set a secure cookie

9. Return `303 See Other`

10. Render no React shell, HTML content or third-party resources

Cookie names:

- `__Secure-hz_appt_receipt`

- `__Secure-hz_appt_manage`

Cookie properties:

- `HttpOnly`

- `Secure`

- `SameSite=Lax`

- Route-specific `Path`

- Short `Max-Age`

Do not use a `__Host-` prefix with a route-specific path.

Tokenless pages validate on every request:

- Session hash

- Scope

- Sliding expiry

- Absolute expiry

- Revocation

- Appointment state

Receipt scope is read-only.

Management mutations require `appointment_manage`.

Route headers:

- `Referrer-Policy: no-referrer`

- `Cache-Control: private, no-store, max-age=0`

- `X-Robots-Tag: noindex, nofollow`

Also:

- Exclude from sitemap

- Disable analytics and session replay

- Redact route parameters and query strings in logs

- Load no third-party embeds

- Never include tokens in WhatsApp, calendar files, logs, analytics or notifications

---

## 20. Management Link and Calendar File

The success page shows:

- Booking code

- Service

- Date and time

- Studio directions

- Copy-private-link button

- Warning that anyone holding the link can manage the appointment

- Add-to-calendar action

- Token-free WhatsApp prefill

The private link is available only from:

- Initial booking response

- A valid idempotent retry while its original token version remains current

- Explicit admin link regeneration

Never recover it through booking code.

A refreshed receipt page does not reissue the private management link.

Calendar file contents:

- Service name

- Date and time

- Studio address

- Display-only booking code

- Public contact information

- Public website URL

Calendar file must not contain:

- Receipt token

- Management token

- Private management URL

- Customer note

- Admin note

- Hidden identifiers

Generate RFC 5545-compliant content with correct escaping, line endings, timezone handling and a stable event UID.

---

## 21. RLS and Mutation Boundaries

Admin may use RLS-protected direct `SELECT` through server functions.

Do not allow direct authenticated `INSERT`, `UPDATE` or `DELETE` on:

- Appointments

- Customers

- Business hours

- Schedule exceptions

- Availability blocks

- Services

- Gallery metadata

- Testimonials

- FAQs

- Site settings

- Contact-message state

- Notifications

- Audit records

All mutations use individually named RPCs.

Examples:

- `admin_create_booking`

- `admin_reschedule_booking`

- `admin_cancel_booking`

- `admin_complete_booking`

- `admin_mark_no_show`

- `admin_override_terminal_state`

- `admin_regenerate_manage_link`

- `admin_upsert_service`

- `admin_update_business_hours`

- `admin_upsert_schedule_exception`

- `admin_upsert_availability_block`

- `admin_delete_availability_block`

- `admin_upsert_gallery_item`

- `admin_update_testimonial`

- `admin_update_faq`

- `admin_update_public_settings`

- `admin_update_contact_status`

- `admin_mark_notifications_read`

Every admin RPC requires:

- `has_role(auth.uid(), 'admin')`

- Input validation

- Required state transition

- Required advisory and row locks

- Row-version validation where relevant

- Audit insertion

Do not create a generic JSON mutation RPC.

---

## 22. Function Security and Grants

Every `SECURITY DEFINER` function must:

- Use `SET search_path = ''`

- Fully qualify every referenced object

- Revoke execution from `PUBLIC`

- Receive only the minimum required explicit grant

- Revalidate inputs

- Ignore client-provided authorization hints

### Public read functions

Grant to:

- `anon`

- `authenticated`

- `service_role`

Examples:

- Public site settings allowlist

- Published services

- Published gallery

- Published testimonials

- Published FAQs

Anonymous users must never directly select the full `site_settings` table.

### Admin RPCs

Grant only to:

- `authenticated`

Also perform an in-function admin-role and AAL check where required.

Do not invoke these functions through service role when authorization relies on `auth.uid()`.

### Public-write entry RPCs

Grant only to:

- `service_role`

Examples:

- Public booking

- Contact submission

- Customer cancellation

- Customer rescheduling

- Appointment-session exchange

- Rate-limit consumption

- Idempotency entry

- Maintenance jobs

### Private helpers

Store in `private`.

Grant no API role direct execution.

---

## 23. Service-Role Isolation

Keep the service-role client in one server-only module.

Rules:

- Never import it into browser or shared client code

- Never use it to determine whether Hazel is an admin

- Never use arbitrary raw table writes

- Use only reviewed RPC entry points and maintenance operations

- Log operation names, not PII payloads

- Add a blocking static check or code-review rule for unauthorized service-role usage

---

## 24. Admin Authentication and MFA

Use server-only Supabase Auth.

Forbidden:

- Browser-side Supabase Auth client

- Browser `setSession`

- Auth tokens in localStorage

- Auth tokens in loader data

- JavaScript-readable authentication cookies

- Direct browser-to-Supabase admin queries

### Login

The login server function:

1. Validates CSRF

2. Applies trusted rate limiting

3. Calls server-side sign-in

4. Returns a generic invalid-credentials error

5. Sets secure HttpOnly cookies

6. Redirects to MFA verification or the admin dashboard

### MFA

Require TOTP MFA for every admin account.

Rules:

- Password-only sessions are AAL1

- Only MFA enrollment and verification routes are available at AAL1

- All protected admin loaders and server functions require AAL2

- Administration RPCs for sensitive operations require AAL2

- Define secure factor enrollment, verification, replacement and account-recovery procedures

- Replacing a factor requires recent password verification and a controlled recovery procedure

- MFA events are audited without storing TOTP secrets

### Session verification

The request-scoped server client:

- Reads cookies

- Refreshes sessions

- Writes rotated cookies to the response

- Uses verified `getUser()`

- Loads role from `user_roles`

- Verifies AAL2 before protected admin operations

Every private server function repeats authentication, role and AAL checks.

### Session limits

Configure:

- 30-minute inactivity timeout

- Maximum 12-hour absolute session lifetime

- One active admin session where supported

- If single-session enforcement is unavailable, document the exception and detect suspicious parallel sessions

Require recent reauthentication for:

- Private-link regeneration

- MFA replacement

- Critical security settings

- Data export

- Terminal-state override

- Destructive operations

Track recent reauthentication only in secure server-managed session state.

### Logout

Logout:

- Clears all server-managed auth and MFA cookies

- Clears TanStack Query caches

- Revokes the current session where supported

- Redirects with history replacement

Responses that create, refresh or clear authentication must never use shared caching.

---

## 25. Password Recovery

Use Supabase Auth PKCE.

Routes:

- `/admin/sifremi-unuttum`

- `/admin/auth/callback`

- `/admin/sifre-sifirla`

Flow:

1. A rate-limited server function receives the email

2. Always return a generic response

3. Request a recovery email with an exact allowlisted callback

4. Store PKCE verifier and state in secure server-managed cookies

5. Callback validates state

6. Exchange the authorization code server-side

7. Create a temporary recovery session

8. Permit one password update

9. Invalidate the recovery session

10. Clear recovery cookies

11. Require a fresh normal login

12. Require MFA enrollment or verification before protected access

Do not allow arbitrary redirect URLs.

Verify production SMTP and recovery-email deliverability before launch.

---

## 26. Trusted IP, Rate Limits and CSRF

Trust only hosting-platform-verified client-IP metadata.

Never blindly trust arbitrary forwarding headers.

Document:

- Which proxy sets the trusted value

- Whether inbound forwarding headers are stripped or overwritten

- Which value is considered the client IP

Fallback rate-limit identities:

- Email HMAC

- Phone HMAC

- Token hash

- Appointment-session ID

- Authenticated user ID

Rate-limit:

- Public booking

- Contact form

- Availability scraping

- Token exchange

- Appointment management

- Admin login

- Password recovery

- MFA verification

- Upload preparation

- Upload finalization

Do not store raw IP addresses.

Return a generic `429` response with `Retry-After`.

Register TanStack CSRF middleware in `src/start.ts`.

Apply CSRF protection to every state-changing server function:

- Booking

- Contact submission

- Cancellation

- Rescheduling

- Link regeneration

- Admin login

- Password recovery

- Password update

- MFA changes

- Admin mutations

- Upload preparation and finalization

Cross-origin mutations must fail.

---

## 27. Global Security Headers

Apply and test global security headers.

Use a restrictive Content Security Policy.

Minimum directives:

- `default-src 'self'`

- `base-uri 'self'`

- `object-src 'none'`

- `frame-ancestors 'none'`

- `form-action 'self'`

- Restricted `script-src`

- Restricted `style-src`

- Restricted `img-src`

- Restricted `font-src`

- Restricted `connect-src`

- Explicit `frame-src` only where an approved map embed is enabled

Prefer nonces or hashes for required scripts.

Also set:

- `Strict-Transport-Security`

- `X-Content-Type-Options: nosniff`

- `Referrer-Policy`

- Minimal `Permissions-Policy`

- Appropriate cross-origin policies where compatible

Do not weaken CSP globally to support an optional third-party embed.

Use route-specific consent and CSP behavior where necessary.

---

## 28. Storage and Gallery Pipeline

Buckets:

- Private `gallery-staging`

- Public-read `gallery-public`

Allowed source formats:

- JPEG

- PNG

- WebP

- AVIF where supported

Reject SVG and other script-capable formats unless separately sanitized and explicitly approved.

Upload flow:

1. Admin requests a signed staging upload

2. Browser uploads to the private staging bucket

3. Admin calls a finalize server function

4. Server verifies:

   - Authenticated AAL2 admin

   - File size

   - Actual file signature

   - Successful image decoding

   - Pixel dimensions

   - Allowed format

5. Server re-encodes the image

6. Strip EXIF and unnecessary metadata

7. Generate responsive variants where practical

8. Save using UUID-based paths

9. Update gallery metadata through an audited RPC

10. Delete the staging object

Do not trust:

- Filename extension

- Browser MIME type

- Client compression alone

Clean abandoned staging objects.

Storage policies must restrict:

- Bucket

- Object path

- Read permissions

- Upload permissions

- Update and deletion scope

Public users may read only finalized public assets.

---

## 29. Admin Panel

### Dashboard

Show:

- Today’s appointments

- Next customer

- Available gaps

- Confirmed count

- Cancelled count

- No-show count

- New contact messages

- Unread notifications

- Quick appointment

- Quick break

- Quick closure

### Appointments

Provide:

- Day view

- Week view

- List view

- Filters

- Add

- Edit

- Reschedule

- Cancel

- Complete

- Mark no-show

- Notes

- WhatsApp shortcut

### Schedule

Manage:

- Weekly hours

- Schedule exceptions

- Breaks

- Time off

- Manual closures

- Emergency booking-disabled switch

### Services

Manage:

- Add and edit

- Soft deactivation

- Price type

- Price

- Duration

- Buffers

- Bookable status

- Display order

### Customers

Show:

- Contact information

- Appointment history

- Future appointments

- Private notes

Also include:

- Gallery

- Testimonials

- FAQ

- Contact inbox

- Notifications

- Public settings

- Private-link regeneration

- MFA and account-security settings

Use `row_version` to protect against stale writes.

When stale data is detected, show:

`Bu randevu başka bir işlem sırasında güncellendi. En son bilgileri yeniden yükledik.`

---

## 30. Policies

Admin-editable settings:

- Minimum booking notice

- Maximum booking range

- Cancellation deadline

- Rescheduling deadline

- Slot granularity

- Receipt-token lifetime

- Management-token lifetime

- Emergency booking-disabled flag

Customer actions use the current policy at request time.

The original accepted booking and privacy versions remain stored on the appointment.

Admin overrides require:

- AAL2

- Recent reauthentication where sensitive

- Explicit confirmation

- Reason

- Audit entry

When public booking is disabled:

- Reject new public bookings

- Show a clear temporary-unavailability message

- Preserve existing appointment management

- Allow Hazel to create appointments manually

---

## 31. Accessibility and Responsive Design

Target WCAG 2.2 AA behavior.

Requirements:

- Semantic landmarks

- One H1 per page

- Skip link

- Keyboard navigation

- Visible focus

- Persistent labels

- Accessible error associations

- Live-region status updates

- Dialog focus trapping and restoration

- ESC-close behavior

- Meaningful alt text

- Status never communicated through color alone

- 44–48px touch targets

- Keyboard-operable calendar

- Reduced-motion support

- Accessible gallery and lightbox

- Logical source and reading order

- Masonry layout must not create confusing keyboard or screen-reader order

Test at:

- 360px

- 390px

- 430px

- 768px

- 1024px

- 1280px and above

Rules:

- No accidental horizontal overflow

- Inputs at least 16px on mobile

- Suitable dialogs become bottom sheets

- Sticky CTA respects safe-area insets

- Sticky CTA does not overlap:

  - Keyboard

  - Footer

  - WhatsApp control

  - Cookie controls

- Admin tables adapt intentionally

---

## 32. SEO, Privacy and Analytics

For indexable routes:

- Unique title

- Meta description

- Canonical URL

- Open Graph metadata

- Twitter metadata

- Breadcrumbs where useful

Structured data:

- BeautySalon

- Service

- FAQPage

- BreadcrumbList

Do not output real-business structured data while business information remains placeholder content.

Exclude from sitemap:

- Appointment routes

- Admin routes

- Authentication routes

- MFA routes

- Error routes

- Maintenance routes

Preview and staging must use `noindex`.

Analytics remains disabled until:

- A provider is selected

- Real consent behavior is implemented

- Event payloads are reviewed

Never send:

- Name

- Phone

- Email

- Customer notes

- Admin notes

- Tokens

- Private links

- Unnecessary booking codes

No analytics or session replay on:

- Appointment routes

- Admin routes

- Login

- Password recovery

- MFA routes

Cookie preferences must control real script behavior and must not be decorative.

---

## 33. Performance

Requirements:

- Route-level code splitting

- Admin code absent from public entry

- No shared barrel leakage

- Self-hosted fonts

- AVIF or WebP output

- Responsive `srcset`

- Explicit image dimensions

- Lazy-load non-hero media

- Eager-load only the actual hero candidate

- No carousel dependency

- Bound availability requests

- Cache only safe public responses

- Never use shared caching for auth, token or session responses

Record:

- Public entry size

- Route chunk sizes

- Largest hero image size

- Lighthouse results

- Core Web Vitals

Block release if admin-only code enters the initial public graph.

---

## 34. Logging, Monitoring and Alerts

Structured logs include:

- Request ID

- Operation name

- Outcome

- Duration

- Safe error category

Never log:

- PII

- Raw tokens

- Private URLs

- Secrets

- Auth headers

- Passwords

- TOTP secrets

Monitor:

- Booking success rate

- Booking conflicts

- Rate-limit rejection

- Token-exchange failures

- Login and MFA failures

- Database RPC failures

- Server errors

- Storage processing failures

- Cleanup-job failures

- Availability outage

- Booking outage

Alert on:

- Repeated server errors

- Booking flow outage

- Abnormal authentication failures

- Storage failures

- Cleanup failures

- Backup failures where observable

Error-monitoring integrations must scrub request bodies, route tokens and query parameters.

---

## 35. Backups and Disaster Recovery

Use managed daily database backups.

Additionally:

- Verify production backup availability and retention

- Create a monthly encrypted logical database export

- Store exports outside the production project

- Back up the active and historical HMAC key ring separately

- Back up required configuration and recovery documentation

- Perform a restore drill before launch

- Repeat restore drills quarterly

Document:

- Recovery-point objective

- Recovery-time objective

- Database restoration

- Auth-user restoration limitations

- Storage restoration

- HMAC-key restoration

- Secret reconfiguration

- DNS and domain recovery

- Key-rotation rollback

A backup is not considered verified until it has been restored successfully in a test.

---

## 36. Data Retention

Technical retention:

- Rate-limit counters: 24 hours

- Idempotency rows: 24 hours

- Expired appointment-access sessions: 24 hours after expiry

- Contact IP HMAC and user agent: 30 days

- Read notifications: 90 days

- Audit logs: 24 months

Owner or legal approval is still required for:

- Customer profiles

- Appointment history

- Contact-message bodies

- Customer notes

- Consent records

Until approved:

- Do not silently delete business records

- Provide an anonymization workflow

- Separate operational history from unnecessary PII

- Document the final retention policy before launch

---

## 37. CI/CD and Release Gates

Every pull request and production deployment must pass:

- Formatting

- Linting

- TypeScript type checking

- Unit tests

- Clean-database migration test

- RLS and grant tests

- Production build

- Bundle-isolation inspection

- Dependency vulnerability scan

- Secret scan

- Selected Playwright smoke tests

Commit and enforce the package lockfile.

Any failed required step blocks deployment.

Production migrations must run through the version-controlled release process.

Do not deploy unreviewed manual production database changes.

---

## 38. Testing

### Unit tests

- Duration and buffers

- Occupied ranges

- Availability

- Weekly hours

- Schedule exceptions

- Timezone boundaries

- Phone normalization

- Price formatting

- Snapshots

- Consent persistence

- Token derivation

- Token key versions

- Booking-code generation

- State machine

- Request fingerprint canonicalization

- Advisory-lock key generation

- Log redaction

### Database and integration tests

- Public booking

- Admin booking

- Overlap rejection

- Booking versus closure race

- Business-hours change versus booking race

- Cancellation

- Customer rescheduling

- Admin rescheduling

- Normal reschedule preserves private link

- Explicit link regeneration

- Old token rejected after regeneration

- Active manage sessions revoked after cancellation

- Active manage sessions revoked after link regeneration

- Receipt expiry

- Special opening

- Full closure

- Inactive service

- Snapshot preservation

- Consent evidence preservation

- Customer upsert

- Duplicate UUID rejection

- Transaction rollback

- Row-version conflict

- State-machine rejection

- Policy-deadline enforcement

- Admin override audit

### Idempotency tests

- Same key and fingerprint returns original result

- Same key and different fingerprint returns 422

- Concurrent identical requests create one appointment

- Failed transaction leaves no idempotency row

- Expired key creates a fresh operation

- Cancellation retry is safe

- Reschedule retry is safe

- Link-regeneration retry is safe

- Stored result contains no token

- Old booking retry does not reveal a regenerated management token

### Authorization tests

- Private schema inaccessible

- Private helpers inaccessible

- Direct authenticated mutations rejected

- Admin role required

- AAL2 required for protected administration

- Sensitive operations require recent reauthentication

- Service-role-only grants work only where intended

- Admin RPCs are not invoked through service role when relying on `auth.uid()`

- Public settings return only allowlisted fields

### Token and session tests

- Exchange returns 303

- Exchange renders no HTML

- Secure cookie is set

- Tokenless refresh works

- Sliding expiry respects absolute expiry

- Receipt session cannot mutate

- Revoked management session fails

- Required headers are present

- Logs redact token routes

- Calendar file contains no token

### Authentication and MFA tests

- Server-only login

- Generic login failure

- Login rate limit

- MFA enrollment

- MFA verification

- AAL1 blocked from protected admin

- AAL2 allowed

- Session inactivity timeout

- Absolute session timeout

- Recent reauthentication requirement

- Session refresh

- No token in browser state or localStorage

- Logout clears all cookies

- PKCE recovery

- Recovery state validation

- Recovery reuse blocked

- Arbitrary redirect rejected

- MFA recovery procedure tested

### Storage tests

- Unauthorized upload rejected

- Invalid MIME declaration rejected

- Invalid file signature rejected

- SVG rejected

- Oversized image rejected

- Invalid image decode rejected

- EXIF removed

- Final public asset readable

- Staging object removed

- Abandoned staging cleanup

- Safe object paths

### Security-header tests

Verify:

- CSP

- HSTS

- `frame-ancestors`

- `nosniff`

- Referrer policy

- Permissions policy

- Token-route cache controls

### CSRF tests

- Cross-origin mutations rejected

- Same-origin mutations accepted

- Custom middleware does not disable protection

### Concurrency tests

Use independent database connections:

- Two bookings for one slot

- Booking versus closure

- Two reschedules to one slot

- Admin versus customer edit

- Weekly-hours update versus booking

- Advisory-lock key consistency

### E2E tests

- Full public booking

- Conflict alternatives

- Copy private link

- Add token-free calendar file

- Manage appointment

- Customer cancellation

- Admin login and MFA

- Admin booking

- Admin closure

- Admin reschedule

- Link regeneration

- Mobile navigation

- Empty states

- Error states

- Booking-disabled mode

### Bundle acceptance

After production build:

- Inspect build manifest

- Confirm admin chunks are lazy and separate

- Confirm admin-only dependencies are absent from public entry

- Confirm no barrel leakage

- Record sizes

- Block release on leakage

---

## 39. Implementation Order

### Phase 1 — Foundation

- Environments

- Routes

- Design tokens

- Typography

- Shared UI kit

- Public and admin shells

- Error boundaries

- CSRF

- Global security headers

- Request IDs

- Log redaction

- CI foundation

### Phase 2 — Public Website

- All public pages

- Responsive behavior

- Accessibility foundation

- Clearly marked placeholder content

- Consent-aware map behavior

### Phase 3 — Database and Security

- Ordered migrations

- Public and private schemas

- Tables

- Constraints

- Indexes

- RLS

- Named RPCs

- Grant matrix

- Advisory locks

- Admin-role bootstrap

- Storage buckets and policies

- Secrets

- Key-ring backup

- Backup verification

### Phase 4 — Booking Engine

- Availability

- Schedule exceptions

- Booking transaction

- Idempotency

- Consent evidence

- Token creation

- Key versions

- Token exchange

- Access sessions

- Success page

- Appointment management

- Cancellation

- Rescheduling

- Link regeneration

- Calendar file

### Phase 5 — Admin Authentication

- Server-only login

- Secure cookies

- Session refresh

- Session limits

- TOTP MFA

- AAL enforcement

- Recent reauthentication

- Logout

- PKCE password recovery

- Authentication rate limits

### Phase 6 — Admin Product

- Dashboard

- Appointments

- Schedule

- Services

- Customers

- Gallery

- Testimonials

- FAQ

- Contact inbox

- Notifications

- Settings

- Link regeneration

- Account security

### Phase 7 — Quality and Operations

- Unit tests

- Integration tests

- Authorization tests

- Concurrency tests

- Auth and MFA tests

- CSRF tests

- Storage tests

- E2E tests

- Accessibility

- SEO

- Performance

- Security headers

- Bundle inspection

- Monitoring

- Cleanup jobs

- Restore drill

### Phase 8 — Production Preparation

- Real business information

- Real prices

- Real photos

- Real reviews

- Approved policies

- Retention decision

- Production SMTP

- Analytics and consent decision

- Domain

- Structured data

- Sitemap

- Open Graph

- Final launch QA

- Disaster-recovery runbook

---

## 40. Production Blockers

Do not call the project production-ready until:

- GiST exclusion constraint passes concurrency tests

- Schedule and booking advisory locks pass race tests

- Weekly-hours edits cannot race with bookings

- Normal rescheduling preserves the private management link

- Cancellation revokes management sessions

- Link regeneration revokes old tokens and sessions

- Row-version checks work

- Appointment state machine works

- Consent evidence is stored on appointments

- Direct table mutations are blocked

- Every mutation uses an audited named RPC

- Public write RPCs are service-role-only

- Private schema is not exposed

- No raw token is persisted

- Token key rotation and restoration are tested

- Idempotency is tested concurrently

- Old idempotency retries cannot reveal regenerated links

- Admin authentication is server-only

- TOTP MFA and AAL2 enforcement work

- Session inactivity and absolute limits work

- Sensitive operations require recent reauthentication

- PKCE recovery works

- Global security headers pass tests

- Storage finalization validates and re-encodes images

- Cross-origin mutations fail

- Token routes use no-store, no-referrer and noindex

- Calendar files contain no private credentials

- Admin code does not leak into public entry

- Health endpoint exposes no internal details

- CI/CD release gates are active

- Monitoring alerts are configured

- Database and HMAC-key backups restore successfully

- Placeholder business information is replaced or withheld

---

## 41. Required Before Launch

- Confirmed business name

- Address

- Phone

- WhatsApp

- Instagram

- Map location

- Opening hours

- Schedule exceptions

- Service list

- Price types

- Prices

- Durations

- Buffers

- Minimum booking notice

- Maximum booking range

- Cancellation deadline

- Rescheduling deadline

- Receipt-token lifetime

- Management-token lifetime

- Hazel’s admin email

- Real photos

- Bio

- Real reviews

- Approved privacy policy

- Approved booking and cancellation terms

- Policy version identifiers

- Data-retention decision

- Production SMTP

- MFA recovery procedure

- Disaster-recovery owner

---

## 42. Deferred Features

Not included in v1:

- AI WhatsApp bot

- Automatic customer notifications

- Multi-staff scheduling

- Payments

- Deposits

- POS

- Accounting

- Inventory

- Loyalty

- Memberships

- Mobile application

- Complex CRM

- Advertising automation

- Advanced financial reporting

Future multi-staff overlap rule:

`EXCLUDE USING gist (provider_id WITH =, occupied_range WITH &&) WHERE (status = 'confirmed')`

After approval, begin Phase 1 immediately.

Do not produce another planning cycle unless implementation discovers a concrete blocking incompatibility.