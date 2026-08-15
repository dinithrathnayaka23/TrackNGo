# Live GPS Tracking — How to Test

How to verify that a driver's GPS coordinates reach a passenger's map accurately.

The pipeline has three stages, and each can be tested on its own before you test
the whole thing end to end:

```
Driver phone GPS  ──▶  GpsTracker (filter + smooth)  ──▶  POST /api/tracking/live-location
                                                                     │
                                            LiveLocationQualityService (validate + score)
                                                                     │
                                                        WebSocket /ws/tracking
                                                                     │
                                    Passenger map (dedupe → snap to route → animate)
```

---

## 1. Automated tests

These need no phone, no server, and no GPS signal. Run them first.

```bash
# Backend — 23 tests covering validation, jump rejection, scoring, staleness
cd backend/trackngo-backend
mvn -pl tracking-module test -Dtest=LiveLocationQualityServiceTest

# Driver app — 28 tests covering the capture filter and the Kalman smoother
cd frontend/driverapp
npx jest src/__tests__/gpsQuality.test.ts

# Passenger app — 33 tests covering snapping, confidence decay and interpolation
cd frontend/mobile-app/TrackNgo-Mobile
npx jest __tests__/utils/liveTracking.test.ts
```

All three should be green. Between them they cover the cases that are painful to
reproduce on a real road: a fix that teleports 11 km in one second, a fix that
arrives out of order, a signal that degrades to 250 m accuracy, a bus parked at a
stop, and a bus doing 100 km/h.

---

## 2. Testing the server on its own

Start the backend, then send fixes by hand. No phone needed.

```bash
cd backend/trackngo-backend
mvn -pl app spring-boot:run
```

### A good fix is accepted and scored

```bash
curl -s -X POST http://localhost:8080/api/tracking/live-location \
  -H "Content-Type: application/json" \
  -d '{"busNumber":"ND-4589","latitude":6.9271,"longitude":79.8612,"accuracy":4}'
```

Expect `success: true` and `accuracyPercent: 100`. A 4 m fix is as good as GPS gets.

### A vague fix is rejected

```bash
curl -s -X POST http://localhost:8080/api/tracking/live-location \
  -H "Content-Type: application/json" \
  -d '{"busNumber":"ND-4589","latitude":6.9271,"longitude":79.8612,"accuracy":250}'
```

Expect `success: false` and a message naming the accuracy. A 250 m radius covers
several streets, so it cannot answer "which stop is the bus at".

### A teleport is rejected

Send the good fix above, then immediately:

```bash
curl -s -X POST http://localhost:8080/api/tracking/live-location \
  -H "Content-Type: application/json" \
  -d '{"busNumber":"ND-4589","latitude":7.0271,"longitude":79.8612,"accuracy":4}'
```

Expect `success: false` with "Implausible jump" — that is 11 km in the time
between two curl commands.

### Confidence decays

Send a good fix, then read it back after a pause:

```bash
curl -s http://localhost:8080/api/tracking/live-location/ND-4589
```

`accuracyPercent` stays at whatever the fix scored. `confidencePercent` starts
equal to it, then falls once the fix passes 5 seconds old and reaches 0 at 30
seconds, where `stale` flips to `true`. Read it back a few times to watch it
drop. The coordinates keep being returned — a stale position is still worth
showing as "last seen", it just must not be shown as "live".

---

## 3. Testing with a real phone as the bus

You do not need two physical devices. `bus-sharer.html` turns any phone's browser
into a bus.

1. Start the backend. It serves the page at
   `http://<your-machine-ip>:8080/bus-sharer.html`.
2. On a phone connected to the same Wi-Fi, open that URL.
   Geolocation needs a secure context — if the browser refuses, use the QR tab to
   generate the link, or run the page over `localhost` port-forwarding.
3. Enter your machine's IP and a bus number that exists in your data (e.g.
   `ND-4589`), then press start and allow location access.

The info card now shows **GPS Accuracy**, **Accepted** and **Rejected** counts,
and the activity log prints the server's verdict per fix. Walking outdoors should
give you a steady stream of accepted fixes at ±5–15 m. Walking indoors, you will
watch accuracy degrade and start seeing rejections — that is the filter working,
not a bug.

---

## 4. End to end: driver app → passenger app

1. Log into the **driver app** with a driver who has a bus assigned today, and
   leave location sharing on.
2. Log into the **passenger app** with a booking on that same bus and open the
   live map.

### On the driver's dashboard

The trip badge reads `Live sharing • GPS 92%` with a quality word next to it
(`EXCELLENT` / `GOOD` / `FAIR` / `WEAK`). Walk into a building and it should fall,
and eventually switch to `Weak GPS signal` with a satellite icon.

### On the passenger's map

| What to look at | What correct looks like |
| --- | --- |
| Top-right badge | A percentage, green above 70%, amber below, red `NO SIGNAL` when contact is lost |
| Blue circle around the bus | Radius equals the real accuracy — small outdoors, visibly wider indoors |
| Bus marker movement | Slides smoothly between fixes; never teleports or jitters while the bus is parked |
| `ON ROUTE` badge | Present while the bus is on its route line; the marker sits on the road, not beside it |
| Accuracy caption | `Accurate to ~7 m`, or `Updated 12s ago` when the stream lags |

### Boarding is limited to the trip you booked

"I'm on the Bus" is not available just because the bus is visible. Tracking a
future booking is fine and useful — the same bus is out running today's trip —
but boarding it is not, because boarding switches the ETA to your drop-off,
starts following the bus, and marks the seat occupied.

| Situation | Button |
| --- | --- |
| Booking is for tomorrow | Disabled — "This trip is on Sun, 16 Aug" |
| Booking is today, departure hours away | Disabled — "Boarding opens at 05:30 PM" |
| Within 30 min of departure, bus live | Enabled |
| Trip under way (up to 12 h after departure) | Enabled |
| Trip finished long ago | Disabled — "This trip has already finished" |
| Bus not sharing location | Disabled — "Waiting for the bus…" |

The rule depends only on the journey date and time each booking already carries,
so it applies identically to highway and long-distance seat bookings. The button
re-evaluates every second, so it unlocks on time without reopening the screen.

### The cases worth deliberately provoking

- **Park the bus.** The marker should stop dead, not vibrate, and the badge must
  stay green. Leaving both phones on a desk is the sharpest test here: Android
  applies the time and distance filters on location updates together, so a
  non-zero `distanceInterval` means a stationary phone receives no callbacks at
  all and the bus silently goes dark. `distanceInterval` is 0 for that reason,
  and a 5-second timer republishes the last fix as a backstop.
- **Kill the driver's network** (aeroplane mode). Within 30 s the passenger badge
  goes red `NO SIGNAL`, the marker fades, the accuracy circle disappears, and the
  ETA banner is replaced by "Lost contact with the bus — last seen 34s ago". It
  must never keep counting down a stale ETA.
- **Restore the network.** The badge returns to green within a fix or two.
- **Drive off the route.** After about 150 m the `ON ROUTE` badge becomes
  `OFF ROUTE` and the marker stops being pulled onto the route line. A diversion
  is something the passenger needs to see, so it is deliberately not hidden.

---

## 5. Reference: the numbers and why they are what they are

| Setting | Value | Reasoning |
| --- | --- | --- |
| Accuracy cut-off | 100 m | Beyond this the bus could be on either of two parallel streets |
| 100% score | ≤ 5 m | About the best a phone achieves with a clear sky view |
| Max believable speed | 45 m/s (162 km/h) | Faster than any bus, so it means a bad fix |
| Publish threshold | 8 m moved | GPS scatter alone produces 2–4 m of fake movement |
| Heartbeat | every 10 s | Keeps a parked bus's fix from ageing into "stale" |
| Stale after | 30 s | Past this the fix no longer says where the bus is now |
| Marker slide | 1.2 s | Long enough to read as motion, short enough to stay current |
| Snap tolerance | max(15 m, accuracy), capped at 60 m | Snap only as far as the fix might genuinely be wrong |

The accuracy score is deliberately logarithmic: the gap between 5 m and 10 m
changes which side of the road the bus appears on, while the gap between 80 m and
85 m changes nothing. The same curve is implemented in
`LiveLocationQualityService.accuracyPercent` (Java) and `accuracyPercent`
(TypeScript), and both apps' test suites assert they agree — a 10 m fix scores 77
on either side. If you change one, change the other and both tests will tell you.
