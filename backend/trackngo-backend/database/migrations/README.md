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
