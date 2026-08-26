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

Before deploying the admin-editable support contact feature, run
`V17__support_contact_settings.sql`. It creates the single-row
`support_contact_settings` table (name, role, phone) that the corporate
contract negotiation screen now reads instead of a hardcoded contact, and
seeds it with the values that were previously hardcoded so nothing changes
until an admin edits it from Settings.

Before deploying the corporate contract discount feature, run
`V18__corporate_contract_discount.sql`. It adds `original_billing_amount`,
`discount_amount` and `admin_note` to `corporate_contract` so an admin can
apply a manual discount when approving a contract, mirroring the discount
already supported for trip bookings. Existing rows are backfilled with
`original_billing_amount = billing_amount` so nothing changes until a
discount is applied.

Before deploying the corporate profile validation fix, run
`V19__corporate_profile_extra_fields.sql`. It adds `website` and
`employee_count` to `corporate_user` — fields the mobile edit form already
collected but silently discarded, since no column backed them.

Before deploying mutual-consent contract cancellation, run
`V20__corporate_contract_cancellation.sql`. It adds `cancel_status`,
`cancel_requested_by`, `cancel_reason`, `cancel_requested_at`,
`cancel_effective_date` and `cancel_response_reason` to `corporate_contract`
so either party can request cancellation with a reason and the other must
accept before it takes effect.

Before deploying monthly per-bus corporate billing, run
`V21__corporate_invoice_billing.sql`. It drops and recreates
`corporate_invoices` (previously only a dump/seed artifact with no real
migration history or writer) as the real table backing one invoice per
assigned bus per billing period, paid via Stripe.

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
