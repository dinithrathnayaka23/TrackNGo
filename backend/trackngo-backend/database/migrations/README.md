# Database migrations

Run migrations against the production MySQL database before deploying the
application build that references the new tables. Do not run the migration
concurrently from multiple release jobs.

For the seat-booking concurrency migration:

1. Take a database backup.
2. Run `V2__seat_booking_concurrency.sql` with an operator account.
3. If the legacy backfill reports a duplicate key, stop and resolve those
   existing duplicate assignments with the booking team. Do not use
   `INSERT IGNORE`; it would silently pick a winner.
4. Deploy the application instances. They may be rolled out gradually because
   the table is created before the new code starts using it.
5. Verify the unique key exists:

```sql
SHOW CREATE TABLE seat_booking_seat;
```

The application keeps `seat_booking.seat_number` for compatibility with
existing reporting and API responses. `seat_booking_seat` is the source of
truth for current seat occupancy.

Before enabling route/bus disruption handling, also run
`V3__booking_disruption_refunds.sql`. It adds the cancellation reason,
provider-payment reference, and idempotency fields used by refund processing.
Then run `V4__booking_restoration_notifications.sql` before deploying the
active-again notification workflow.
Finally run `V5__bus_disruption_database_guard.sql`. It adds a database trigger
and repairs any bookings left confirmed while a bus was already unavailable.

Before deploying the private-trip negotiation flow, run
`V9__trip_booking_negotiation.sql`. It adds the estimate, negotiated discount,
administrator note, and negotiation timestamp used by the passenger review
screen and admin approval panel.

Before deploying trip-bus assignment changes, run
`V10__trip_bus_date_reservations.sql`. It creates one reservation row per bus
per calendar day and backfills pending, confirmed, and in-progress trip
assignments. The unique `(bus_id, reserved_date)` key is the database-level
concurrency guard: only one trip booking can hold a bus on any day. The
application locks the bus row, checks the full date range, and releases the
reservation when a trip is cancelled or completed.

Before deploying the corporate morning/evening shift booking and standard
pricing changes, run `V12__corporate_contract_shifts.sql`. It adds shift
type, a full per-shift pickup/drop-off route (place name, coordinates, time)
for both morning and evening, employee count, working days, bus type and
distance columns to `corporate_contract`, and backfills existing rows from
the legacy single shift window so historical contracts keep meaningful
start/end times.

Before deploying corporate multi-bus assignment, run
`V13__corporate_contract_bus_assignment.sql`. It adds the
`corporate_contract_bus` join table so a contract whose employee headcount
exceeds one bus's seat capacity can be served by several buses, and
backfills one row per contract from the legacy single `bus_id` column.

Before deploying admin-configurable corporate pricing, run
`V14__corporate_pricing_settings.sql`. It creates the single-row
`corporate_pricing_settings` table (rate per km by bus size, AC/Mini Bus
surcharges, working-days-per-month) that `CorporatePricingService` now reads
at request time instead of using hardcoded constants, and seeds it with the
values the formula already used so pricing is unchanged until an admin edits it.

Before deploying the corporate negotiation-finalization flow, run
`V15__corporate_contract_finalization.sql`. It adds `finalized_at` to
`corporate_contract` so the mobile app can tell "admin approved" (status =
active) apart from "the corporate user confirmed the final offer" — a
contract stays in the Pending Contracts list as "Request Approved" until
finalized, then moves to Active Contracts.

Before deploying Tamil as a passenger language option, run
`V16__user_language_preference_tamil.sql`. It widens `user.language_preference`
from `ENUM('en', 'si')` to `ENUM('en', 'si', 'ta')` — without it, saving
`ta` from the profile settings screen fails with a database error because
MySQL rejects enum values outside the declared set.

Before deploying the booking-completion changes, run
`V17__complete_elapsed_bookings.sql`. It marks bookings whose journey date has
passed as `completed`. Nothing in the application previously set that status —
only the development seed script did — so real bookings stayed `confirmed`
indefinitely, appearing as active in booking history and being skipped by driver
earnings and promotion eligibility, which both filter on `status = 'completed'`.
`BookingCompletionService` performs this transition on a schedule from now on, so
this migration only repairs rows that predate it. It is idempotent, safe to
re-run, and never touches cancelled bookings.

Before deploying the corporate advance-payment flow, run
`V18__corporate_advance_payment.sql`. It adds the deposit amount, its payment
status, the paid-at timestamp and the gateway transaction id to
`corporate_contract`, so a finalized contract can record the one-month advance
the corporate user pays before the service starts.

Before deploying the admin-editable support contact feature, run
`V19__support_contact_settings.sql`. It creates the single-row
`support_contact_settings` table (name, role, phone) that the corporate
contract negotiation screen now reads instead of a hardcoded contact, and
seeds it with the values that were previously hardcoded so nothing changes
until an admin edits it from Settings.

Before deploying the corporate contract discount feature, run
`V20__corporate_contract_discount.sql`. It adds `original_billing_amount`,
`discount_amount` and `admin_note` to `corporate_contract` so an admin can
apply a manual discount when approving a contract, mirroring the discount
already supported for trip bookings. Existing rows are backfilled with
`original_billing_amount = billing_amount` so nothing changes until a
discount is applied.

Before deploying the corporate profile validation fix, run
`V21__corporate_profile_extra_fields.sql`. It adds `website` and
`employee_count` to `corporate_user` — fields the mobile edit form already
collected but silently discarded, since no column backed them.

Before deploying mutual-consent contract cancellation, run
`V22__corporate_contract_cancellation.sql`. It adds `cancel_status`,
`cancel_requested_by`, `cancel_reason`, `cancel_requested_at`,
`cancel_effective_date` and `cancel_response_reason` to `corporate_contract`
so either party can request cancellation with a reason and the other must
accept before it takes effect.

Before deploying monthly per-bus corporate billing, run
`V23__corporate_invoice_billing.sql`. It drops and recreates
`corporate_invoices` (previously only a dump/seed artifact with no real
migration history or writer) as the real table backing one invoice per
assigned bus per billing period, paid via Stripe.

Before deploying the corporate renewal reminder, run
`V24__corporate_contract_renewal_reminder.sql`. It adds
`renewal_reminder_sent_at` to `corporate_contract` so
`CorporateRenewalReminderScheduler` sends the "expiring soon" notice to the
admin and the corporate client once per contract instead of every day it runs.

Before deploying email-based (non-authenticator) two-factor login, run
`V25__email_otp_login.sql`. It adds `user_settings.email_otp_login_enabled`
and the `login_otp` table backing the one-time codes AuthServiceImpl emails
at login time when an account has this enabled — currently surfaced as the
"Two-Factor Authentication" toggle in the driver app's profile settings. Both
are also self-healed at application startup, so a fresh environment that
skips this file still ends up correct on first run. Note the `ALTER TABLE`
statement intentionally omits `IF NOT EXISTS`: some MySQL builds used in this
project's dev environments reject that syntax on `ADD COLUMN`. Skip that
statement by hand if the column is already present.

Before deploying the driver app's "Mark as Boarded" action, run
`V26__seat_booking_boarded_status.sql`. It widens `seat_booking.status` to
include `'boarded'` — several services (`BookingCompletionService`,
`DriverEarningsService`, `BookingRepository`) already query for that status,
but nothing had ever added it to the enum, so
`BookingFlowService.markPassengerBoarded()` fails outright on any database
created from the original schema.

Before deploying two-step contract renewal, run
`V27__corporate_contract_renewal_request.sql`. It adds `renewal_request_status`
and `renewed_from_contract_id` to `corporate_contract`, so the corporate
client can ask admin for permission to renew before filling out the actual
renewal terms, and so a contract created as a renewal skips the advance
deposit when approved (it's a continuation of billing, not a fresh contract).

Before deploying independent AC/Mini Bus selection, run
`V28__corporate_contract_ac_mini_independent.sql`. It adds `is_ac` to
`corporate_contract` and narrows `bus_type` to `('standard', 'mini')`,
backfilling existing `'ac'` rows to `bus_type = 'standard', is_ac = true` so
their pricing is unchanged. Before this, a bus could only be "Standard",
"AC" or "Mini" — never AC *and* Mini — because the surcharges were mutually
exclusive in code. Now both apply together when relevant.

Before deploying the corporate contact-person email field, run
`V32__corporate_contact_email.sql`. It adds `contact_email` to
`corporate_user` so the corporate sign-up and profile screens' "Contact
Person Email Address" field actually persists, instead of being held in UI
state only and discarded on save.

Disruption handling behaves as follows:

- Future confirmed bookings are cancelled and their seat reservations released.
- A notification is written for each affected passenger.
- A single pending refund request is written for each booking.
- Stripe refunds are processed automatically when the booking contains a
  Stripe PaymentIntent ID. Other gateways remain `pending` until their refund
  adapter is implemented or an operator processes them.
- When a bus or route is restored to active, each affected passenger receives
  one service-restored notification. The cancelled booking is not reinstated;
  the passenger must make a new booking because the original seat may have
  been released or refunded.
