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
