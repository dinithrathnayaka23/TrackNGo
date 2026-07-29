package com.trackngo.booking.internal.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.trackngo.booking.api.dto.BookingFlowDtos.*;
import com.trackngo.booking.api.dto.PromotionDtos.PromotionQuoteResult;
import com.trackngo.commons.exception.BusinessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Time;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;

/*
  Core Service for the Booking Flow.
  Handles bus searches, fare calculations based on segments, seat selection,
  and the orchestration of the final booking transaction.
 */
@Service
public class BookingFlowService {

    private static final ZoneId APP_ZONE = ZoneId.of("Asia/Colombo");

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final PromotionService promotionService;

    public BookingFlowService(JdbcTemplate jdbc, ObjectMapper mapper, PromotionService promotionService) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.promotionService = promotionService;
    }

    /*
      1. Search buses by from / to / date
      Matches buses whose route contains BOTH the from-stop and
      to-stop (from must come before to in stop priority).
      Fare is calculated proportionally by distance between stops.
    */
    public List<BusSearchResult> searchBuses(String from, String to, String date, String busCategory) {
        boolean filterCategory = busCategory != null && !busCategory.isBlank();
        String normalizedFrom = normalizeStopKey(from);
        String normalizedTo = normalizeStopKey(to);

        if (normalizedFrom.isBlank() || normalizedTo.isBlank()) {
            return List.of();
        }

        if (normalizedFrom.equals(normalizedTo)) {
            return List.of();
        }

        // Find buses on routes that contain both from-stop and to-stop
        // in either direction. Reverse direction is available only when
        // the bus has a configured return_start_time.
        String sql = """
            SELECT b.bus_id, b.bus_number, b.bus_type, b.bus_brand,
                   b.start_time, b.end_time, b.return_start_time, b.return_end_time,
                   b.seat_capacity, b.amenities,
                   r.fee AS route_fee, r.route_id, r.route_name,
                   r.start_location, r.end_location,
                   r.est_distance_difference AS total_distance,
                   r.estimated_time_duration,
                   rs_from.priority            AS from_priority,
                   rs_to.priority              AS to_priority,
                   rs_from.distance_from_start AS from_distance,
                   rs_to.distance_from_start   AS to_distance,
                   rs_from.name                AS from_stop_name,
                   rs_to.name                  AS to_stop_name,
                   rs_from.estimated_arrival_mins AS from_arrival_mins,
                   rs_to.estimated_arrival_mins   AS to_arrival_mins,
                   d.average_rating,
                   CONCAT(u.first_name, ' ', u.last_name) AS driver_name
            FROM bus b
            JOIN route r ON b.route_id = r.route_id
            JOIN route_stop rs_from ON rs_from.route_id = r.route_id
                                                                        AND LOWER(REPLACE(REPLACE(TRIM(rs_from.name), '-', ''), ' ', '')) = ?
            JOIN route_stop rs_to   ON rs_to.route_id   = r.route_id
                                                                        AND LOWER(REPLACE(REPLACE(TRIM(rs_to.name), '-', ''), ' ', '')) = ?
            LEFT JOIN driver d ON b.driver_id = d.driver_id
            LEFT JOIN `user` u ON d.driver_id = u.user_id
            WHERE (
                    rs_from.priority < rs_to.priority
                    OR (rs_from.priority > rs_to.priority AND b.return_start_time IS NOT NULL)
                  )
              AND b.status = 'active'
              AND r.is_active = 1
            """ + (filterCategory ? "  AND LOWER(b.bus_type) = ?\n" : "") + """
            ORDER BY COALESCE(
                CASE WHEN rs_from.priority > rs_to.priority THEN b.return_start_time ELSE b.start_time END,
                b.start_time
            )
            """;

        List<Map<String, Object>> rows = filterCategory
            ? jdbc.queryForList(sql, normalizedFrom, normalizedTo, busCategory.trim().toLowerCase())
            : jdbc.queryForList(sql, normalizedFrom, normalizedTo);

        List<BusSearchResult> results = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Long busId = ((Number) row.get("bus_id")).longValue();
            int capacity = ((Number) row.get("seat_capacity")).intValue();

            int bookedCount = countBookedSeats(busId, date);
            int available = Math.max(0, capacity - bookedCount);

            List<String> amenities = parseAmenities(row.get("amenities"));

            // Calculate proportional fare based on distance between stops
            BigDecimal fee = calculateSegmentFare(row);

            int fromPriority = ((Number) row.get("from_priority")).intValue();
            int toPriority = ((Number) row.get("to_priority")).intValue();
            boolean reverseDirection = fromPriority > toPriority;

            // Fetch route stops before calculating times so ordered stops can be
            // used when explicit per-stop ETA/distance data has not been saved.
            Long routeId = ((Number) row.get("route_id")).longValue();
            String stopsSql = """
                SELECT rs.name, rs.priority FROM route_stop rs WHERE rs.route_id = ? ORDER BY rs.priority
                """;
            List<Map<String, Object>> stopRows = jdbc.queryForList(stopsSql, routeId);
            List<BusSearchResult.RouteStopInfo> routeStops = new ArrayList<>();
            for (Map<String, Object> stopRow : stopRows) {
                routeStops.add(new BusSearchResult.RouteStopInfo(
                    (String) stopRow.get("name"),
                    ((Number) stopRow.get("priority")).intValue()
                ));
            }
            int firstPriority = routeStops.isEmpty() ? Math.min(fromPriority, toPriority) : routeStops.get(0).priority();
            int lastPriority = routeStops.isEmpty() ? Math.max(fromPriority, toPriority) : routeStops.get(routeStops.size() - 1).priority();

            Object journeyStartObj = reverseDirection ? row.get("return_start_time") : row.get("start_time");
            if (journeyStartObj == null) {
                // Reverse schedule is not configured for this bus.
                continue;
            }

            // Calculate segment-specific times
            int totalDurationMins = row.get("estimated_time_duration") != null
                    ? ((Number) row.get("estimated_time_duration")).intValue() : 0;
            double totalDistance = row.get("total_distance") != null
                    ? ((Number) row.get("total_distance")).doubleValue() : 0.0;
            
            int fromArrivalMins = resolveArrivalMins(
                    row.get("from_arrival_mins"),
                    row.get("from_distance"),
                    fromPriority,
                    firstPriority,
                    lastPriority,
                    totalDurationMins,
                    totalDistance
            );
            int toArrivalMins = resolveArrivalMins(
                    row.get("to_arrival_mins"),
                    row.get("to_distance"),
                    toPriority,
                    firstPriority,
                    lastPriority,
                    totalDurationMins,
                    totalDistance
            );

            int computedFromMins;
            int computedToMins;

            if (reverseDirection && totalDurationMins > 0) {
                // In reverse, the time offset is calculated from the end
                computedFromMins = Math.max(0, totalDurationMins - fromArrivalMins);
                computedToMins = Math.max(0, totalDurationMins - toArrivalMins);
            } else {
                computedFromMins = fromArrivalMins;
                computedToMins = toArrivalMins;
            }

            LocalTime busStartTime = toLocalTime(journeyStartObj);
            String fromTime = busStartTime.plusMinutes(computedFromMins).format(DateTimeFormatter.ofPattern("HH:mm"));
            String toTime = busStartTime.plusMinutes(computedToMins).format(DateTimeFormatter.ofPattern("HH:mm"));

            String routeStartLocation = routeStops.isEmpty()
                    ? stringValue(row.get("start_location"))
                    : routeStops.get(0).name();
            String routeEndLocation = routeStops.isEmpty()
                    ? stringValue(row.get("end_location"))
                    : routeStops.get(routeStops.size() - 1).name();
            String busRouteName = resolveBusRouteName(
                    (String) row.get("route_name"),
                    routeStartLocation,
                    routeEndLocation,
                    (String) row.get("from_stop_name"),
                    (String) row.get("to_stop_name")
            );
            String routeName = busRouteName;

            // (route stops already fetched above)

            results.add(new BusSearchResult(
                    busId,
                    (String) row.get("bus_number"),
                    (String) row.get("bus_type"),
                    (String) row.get("bus_brand"),
                    fromTime,
                    toTime,
                    capacity,
                    available,
                    amenities,
                    fee,
                    (String) row.get("driver_name"),
                    toDouble(row.get("average_rating")),
                    routeName,
                    busRouteName,
                    routeStartLocation,
                    routeEndLocation,
                    routeStops
            ));
        }
        return results;
    }

    /*
       2. Bus details (route stops, driver, amenities)
       Resolves stops and calculates segment-specific fare.
    */
    public BusDetailResult getBusDetails(Long busId, String fromStop, String toStop) {
        String busSql = """
            SELECT b.bus_id, b.bus_number, b.bus_type, b.bus_brand,
                   b.start_time, b.end_time, b.return_start_time, b.return_end_time,
                   b.seat_capacity, b.amenities,
                   r.fee, r.route_id, r.route_name, r.est_distance_difference,
                   r.estimated_time_duration, r.start_location, r.end_location,
                   d.average_rating, d.phone_number AS driver_phone, d.profile_photo,
                   CONCAT(u.first_name, ' ', u.last_name) AS driver_name
            FROM bus b
            JOIN route r ON b.route_id = r.route_id
            LEFT JOIN driver d ON b.driver_id = d.driver_id
            LEFT JOIN `user` u ON d.driver_id = u.user_id
            WHERE b.bus_id = ?
            """;

        Map<String, Object> row = jdbc.queryForMap(busSql, busId);

        String dbRouteName = (String) row.get("route_name");

        Long routeId = ((Number) row.get("route_id")).longValue();
        int directionCompare = compareStopPriority(routeId, fromStop, toStop);
        boolean reverseDirection = directionCompare > 0 && row.get("return_start_time") != null;
        Object journeyStartObj = reverseDirection ? row.get("return_start_time") : row.get("start_time");
        Object journeyEndObj = reverseDirection ? row.get("return_end_time") : row.get("end_time");
        if (journeyStartObj == null) {
            journeyStartObj = row.get("start_time");
        }
        if (journeyEndObj == null) {
            journeyEndObj = row.get("end_time");
        }

        String stopsSql = """
            SELECT rs.name, rs.estimated_arrival_mins, rs.distance_from_start, rs.priority
            FROM route_stop rs
            WHERE rs.route_id = ?
            ORDER BY rs.priority ASC
            """;
        List<Map<String, Object>> fullStopRows = jdbc.queryForList(stopsSql, routeId);
        List<Map<String, Object>> traversalStopRows = new ArrayList<>(fullStopRows);
        if (reverseDirection) {
            Collections.reverse(traversalStopRows);
        }

        String routeStartLocation = fullStopRows.isEmpty()
                ? stringValue(row.get("start_location"))
                : stringValue(fullStopRows.get(0).get("name"));
        String routeEndLocation = fullStopRows.isEmpty()
                ? stringValue(row.get("end_location"))
                : stringValue(fullStopRows.get(fullStopRows.size() - 1).get("name"));
        String busRouteName = resolveBusRouteName(dbRouteName, routeStartLocation, routeEndLocation, fromStop, toStop);
        String routeLabel = busRouteName;

        // Calculate segment times if from and to are provided
        String finalStartTime = formatTime(journeyStartObj);
        String finalEndTime = formatTime(journeyEndObj);

        int totalDurationMins = row.get("estimated_time_duration") != null ? ((Number) row.get("estimated_time_duration")).intValue() : 0;
        double totalDistance = row.get("est_distance_difference") != null
                ? ((Number) row.get("est_distance_difference")).doubleValue() : 0.0;
        Map<String, Object> fromStopRow = findStopRow(fullStopRows, fromStop);
        Map<String, Object> toStopRow = findStopRow(fullStopRows, toStop);
        int fromMins = -1;
        int toMins = -1;
        if (fromStopRow != null && toStopRow != null) {
            fromMins = resolveArrivalMins(
                    fromStopRow.get("estimated_arrival_mins"),
                    fromStopRow.get("distance_from_start"),
                    fromStopRow.get("priority"),
                    firstPriority(fullStopRows),
                    lastPriority(fullStopRows),
                    totalDurationMins,
                    totalDistance
            );
            toMins = resolveArrivalMins(
                    toStopRow.get("estimated_arrival_mins"),
                    toStopRow.get("distance_from_start"),
                    toStopRow.get("priority"),
                    firstPriority(fullStopRows),
                    lastPriority(fullStopRows),
                    totalDurationMins,
                    totalDistance
            );
        }

        LocalTime busStartTime = toLocalTime(journeyStartObj);

        if (fromMins != -1 && toMins != -1) {
            int computedFrom = reverseDirection ? Math.max(0, totalDurationMins - fromMins) : fromMins;
            int computedTo = reverseDirection ? Math.max(0, totalDurationMins - toMins) : toMins;
            finalStartTime = busStartTime.plusMinutes(computedFrom).format(DateTimeFormatter.ofPattern("HH:mm"));
            finalEndTime = busStartTime.plusMinutes(computedTo).format(DateTimeFormatter.ofPattern("HH:mm"));
        } else if (totalDurationMins > 0) {
            finalStartTime = busStartTime.format(DateTimeFormatter.ofPattern("HH:mm"));
            finalEndTime = busStartTime.plusMinutes(totalDurationMins).format(DateTimeFormatter.ofPattern("HH:mm"));
        }

        List<Map<String, Object>> displayStopRows = new ArrayList<>(traversalStopRows);
        if (fromStopRow != null && toStopRow != null) {
            int fromPriority = ((Number) fromStopRow.get("priority")).intValue();
            int toPriority = ((Number) toStopRow.get("priority")).intValue();
            int minPriority = Math.min(fromPriority, toPriority);
            int maxPriority = Math.max(fromPriority, toPriority);
            displayStopRows = traversalStopRows.stream()
                    .filter(stopRow -> {
                        int priority = ((Number) stopRow.get("priority")).intValue();
                        return priority >= minPriority && priority <= maxPriority;
                    })
                    .collect(Collectors.toList());
        }

        List<BusDetailResult.RouteStopInfo> routeStops = new ArrayList<>();
        for (Map<String, Object> stopRow : displayStopRows) {
            int arrMins = resolveArrivalMins(
                    stopRow.get("estimated_arrival_mins"),
                    stopRow.get("distance_from_start"),
                    stopRow.get("priority"),
                    firstPriority(fullStopRows),
                    lastPriority(fullStopRows),
                    totalDurationMins,
                    totalDistance
            );
            int computedArrMins = reverseDirection ? Math.max(0, totalDurationMins - arrMins) : arrMins;
            String estTime = busStartTime.plusMinutes(computedArrMins).format(DateTimeFormatter.ofPattern("hh:mm a"));

            routeStops.add(new BusDetailResult.RouteStopInfo(
                    (String) stopRow.get("name"),
                    estTime,
                    ((Number) stopRow.get("priority")).intValue()
            ));
        }

        // Calculate segment-based fare if from/to stops are provided
        BigDecimal fee = toBigDecimal(row.get("fee"));
        if (fromStop != null && !fromStop.isBlank() && toStop != null && !toStop.isBlank()) {
            fee = calculateSegmentFareForRoute(routeId, fee,
                    toBigDecimal(row.get("est_distance_difference")), fromStop, toStop);
        }

        // Format route distance and duration
        String routeDistance = null;
        BigDecimal distance = toNullableBigDecimal(row.get("est_distance_difference"));
        if (fromStopRow != null && toStopRow != null) {
            BigDecimal fromDistance = toNullableBigDecimal(fromStopRow.get("distance_from_start"));
            BigDecimal toDistance = toNullableBigDecimal(toStopRow.get("distance_from_start"));
            if (fromDistance != null && toDistance != null) {
                distance = toDistance.subtract(fromDistance).abs();
            }
        }
        if (distance != null) {
            routeDistance = formatDistance(distance);
        }
        String routeDuration = null;
        int displayDurationMins = totalDurationMins;
        if (fromMins != -1 && toMins != -1) {
            displayDurationMins = Math.abs(toMins - fromMins);
        }
        if (displayDurationMins > 0 || row.get("estimated_time_duration") != null) {
            routeDuration = formatDuration(displayDurationMins);
        }
        
        return new BusDetailResult(
                busId,
                (String) row.get("bus_number"),
                (String) row.get("bus_type"),
                (String) row.get("bus_brand"),
                finalStartTime,
                finalEndTime,
                ((Number) row.get("seat_capacity")).intValue(),
                parseAmenities(row.get("amenities")),
                fee,
                routeLabel,
                busRouteName,
                routeStartLocation,
                routeEndLocation,
                routeDistance,
                routeDuration,
                routeStops,
                row.get("driver_name") != null
                    ? new BusDetailResult.DriverInfo(
                            (String) row.get("driver_name"),
                            (String) row.get("driver_phone"),
                            toDouble(row.get("average_rating")),
                            (String) row.get("profile_photo"))
                    : new BusDetailResult.DriverInfo("Unassigned", null, 0.0, null)
        );
    }

    /*
       3. Seat layout (from DB or generate default)
       Retrieves custom layout if available, else generates a standard one.
    */
    public List<SeatLayoutRow> getSeatLayout(Long busId) {
        String sql = "SELECT seat_label, row_num, position_group, position_index " +
                     "FROM seat_layout WHERE bus_id = ? ORDER BY row_num, position_index";
        List<Map<String, Object>> rows = jdbc.queryForList(sql, busId);

        if (rows.isEmpty()) {
            int capacity = jdbc.queryForObject(
                    "SELECT seat_capacity FROM bus WHERE bus_id = ?", Integer.class, busId);
            return generateDefaultLayout(capacity);
        }

        Map<Integer, List<String>> leftMap = new TreeMap<>();
        Map<Integer, List<String>> rightMap = new TreeMap<>();
        Map<Integer, List<String>> backMap = new TreeMap<>();

        for (Map<String, Object> r : rows) {
            int rowNum = ((Number) r.get("row_num")).intValue();
            String label = (String) r.get("seat_label");
            String group = (String) r.get("position_group");

            switch (group) {
                case "left" -> leftMap.computeIfAbsent(rowNum, k -> new ArrayList<>()).add(label);
                case "right" -> rightMap.computeIfAbsent(rowNum, k -> new ArrayList<>()).add(label);
                case "back" -> backMap.computeIfAbsent(rowNum, k -> new ArrayList<>()).add(label);
            }
        }

        Set<Integer> allRows = new TreeSet<>();
        allRows.addAll(leftMap.keySet());
        allRows.addAll(rightMap.keySet());
        allRows.addAll(backMap.keySet());

        List<SeatLayoutRow> result = new ArrayList<>();
        for (int rowNum : allRows) {
            List<String> back = backMap.getOrDefault(rowNum, null);
            result.add(new SeatLayoutRow(
                    rowNum,
                    leftMap.getOrDefault(rowNum, List.of()),
                    rightMap.getOrDefault(rowNum, List.of()),
                    back
            ));
        }
        return result;
    }

    /*
       4. Booked seats for a bus + date
    */
    public List<String> getBookedSeats(Long busId, String date) {
        String sql = "SELECT seat_number FROM seat_booking " +
                     "WHERE bus_id = ? AND journey_date = ? AND status != 'cancelled'";
        List<String> seatStrings = jdbc.queryForList(sql, String.class, busId, date);

        return seatStrings.stream()
                .flatMap(s -> Arrays.stream(s.split(",")))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }

    /* ═══════════════════════════════════════════════════════════
       4a. Booked seats with passenger details for a bus + date
       ═══════════════════════════════════════════════════════════ */
    public List<BookedSeatInfo> getBookedSeatsWithDetails(Long busId, String date) {
        String sql = """
            SELECT
                sb.seat_booking_id,
                sb.booking_reference,
                sb.journey_date,
                sb.journey_time,
                sb.seat_number,
                CONCAT(u.first_name, ' ', u.last_name) as passenger_name,
                sb.passenger_id,
                p.mobile_number as passenger_phone,
                sb.total_amount,
                sb.status,
                sb.from_stop,
                sb.to_stop,
                sb.special_request
            FROM seat_booking sb
            INNER JOIN passenger p ON p.passenger_id = sb.passenger_id
            INNER JOIN user u ON u.user_id = sb.passenger_id
            WHERE sb.bus_id = ? AND sb.journey_date = ? AND sb.status != 'cancelled'
            ORDER BY sb.seat_number
            """;

        return jdbc.query(sql, (rs, rowNum) -> new BookedSeatInfo(
            rs.getLong("seat_booking_id"),
            rs.getString("booking_reference"),
            rs.getString("journey_date"),
            rs.getString("journey_time"),
            rs.getString("seat_number"),
            rs.getString("passenger_name"),
            rs.getLong("passenger_id"),
            rs.getString("passenger_phone"),
            rs.getBigDecimal("total_amount"),
            rs.getString("status"),
            rs.getString("from_stop"),
            rs.getString("to_stop"),
            rs.getString("special_request")
        ), busId, date);
    }

    /*
       4b. Blocked seats for a bus
       ═══════════════════════════════════════════════════════════ */
    public List<String> getBlockedSeats(Long busId) {
        String sql = "SELECT seat_label FROM seat_layout WHERE bus_id = ? AND blocked = true";
        return jdbc.queryForList(sql, String.class, busId);
    }

    /*
       5. Create booking + payment (transactional)
       Orchestrates the entire booking process:
       - Validates promotion codes.
       - Records the payment transaction.
       - Records the seat reservation.
       - Updates promotion usage.
    */
    @Transactional
    public BookingConfirmationResult createBooking(CreateBookingRequest req) {

        validateBookableJourneyDate(req.journeyDate());

        // 0) Ensure a passenger record exists for this user (FK requirement)
        ensurePassengerExists(req.passengerId());

        BigDecimal payableAmount = req.totalAmount();
        BigDecimal discountAmount = BigDecimal.ZERO;
        Long appliedPromotionId = null;
        boolean promotionRequested = req.promotionId() != null
                || (req.promoCode() != null && !req.promoCode().isBlank());

        if (promotionRequested) {
            BigDecimal originalAmount = req.originalAmount() != null ? req.originalAmount() : req.totalAmount();
            PromotionQuoteResult quote = promotionService.quoteForBooking(
                    req.passengerId(),
                    req.busId(),
                    req.fromLocation(),
                    req.toLocation(),
                    originalAmount,
                    req.promoCode(),
                    true
            );

            if (req.promotionId() != null && !req.promotionId().equals(quote.promotionId())) {
                throw new BusinessException("Selected promotion is no longer available for this booking.");
            }
            if (req.totalAmount() == null || req.totalAmount().subtract(quote.finalAmount()).abs().compareTo(new BigDecimal("0.01")) > 0) {
                throw new BusinessException("Booking amount changed. Please refresh the payment summary and try again.");
            }

            payableAmount = quote.finalAmount();
            discountAmount = quote.discountAmount();
            appliedPromotionId = quote.promotionId();
        }

        String txnId = "TXN-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String bookingRef = "BK-" + req.journeyDate().replace("-", "")
                + "-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase();

        // 1) Insert payment
        KeyHolder paymentKeyHolder = new GeneratedKeyHolder();
        BigDecimal finalPayableAmount = payableAmount;
        jdbc.update(con -> {
            PreparedStatement ps = con.prepareStatement(
                    "INSERT INTO payment (transaction_id, payment_method, payment_status, amount) VALUES (?,?,?,?)",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setString(1, txnId);
            ps.setString(2, req.paymentMethod() != null ? req.paymentMethod() : "stripe");
            ps.setString(3, "success");
            ps.setBigDecimal(4, finalPayableAmount);
            return ps;
        }, paymentKeyHolder);
        Long paymentId = paymentKeyHolder.getKey().longValue();

        // 2) Resolve route_id from bus
        Long routeId = jdbc.queryForObject("SELECT route_id FROM bus WHERE bus_id = ?", Long.class, req.busId());

        // 3) Insert seat_booking
        String seatNumbers = String.join(",", req.seatNumbers());
        jdbc.update(
                "INSERT INTO seat_booking (booking_reference, journey_date, journey_time, seat_number, " +
                "special_request, total_amount, status, passenger_id, bus_id, route_id, payment_id, from_stop, to_stop) " +
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                bookingRef,
                req.journeyDate(),
                req.journeyTime(),
                seatNumbers,
                req.specialRequest(),
                payableAmount,
                "confirmed",
                req.passengerId(),
                req.busId(),
                routeId,
                paymentId,
                req.fromLocation(),
                req.toLocation()
        );

        promotionService.redeem(appliedPromotionId, req.passengerId(), bookingRef, discountAmount);

        // 4) Look up bus info for response
        Map<String, Object> bus = jdbc.queryForMap(
                "SELECT b.bus_number, r.start_location, r.end_location " +
                "FROM bus b JOIN route r ON b.route_id = r.route_id WHERE b.bus_id = ?",
                req.busId()
        );

        // Use passenger's from/to stops if provided, otherwise fall back to route endpoints
        String fromLoc = req.fromLocation() != null && !req.fromLocation().isBlank()
                ? req.fromLocation() : (String) bus.get("start_location");
        String toLoc = req.toLocation() != null && !req.toLocation().isBlank()
                ? req.toLocation() : (String) bus.get("end_location");

        return new BookingConfirmationResult(
                bookingRef,
                "confirmed",
                txnId,
                seatNumbers,
                payableAmount,
                (String) bus.get("bus_number"),
                fromLoc,
                toLoc,
                req.journeyDate(),
                req.journeyTime()
        );
    }

    /*
       6. Get booking by reference
    */
    public BookingConfirmationResult getBookingByRef(String bookingRef) {
        String sql = """
            SELECT sb.booking_reference, sb.status, sb.seat_number, sb.total_amount,
                   sb.journey_date, sb.journey_time,
                   sb.from_stop, sb.to_stop,
                   b.bus_number, r.start_location, r.end_location,
                   p.transaction_id
            FROM seat_booking sb
            JOIN bus b ON sb.bus_id = b.bus_id
            JOIN route r ON sb.route_id = r.route_id
            LEFT JOIN payment p ON sb.payment_id = p.payment_id
            WHERE sb.booking_reference = ?
            """;
        Map<String, Object> row = jdbc.queryForMap(sql, bookingRef);

        // Use passenger's from/to stops if saved, otherwise fall back to route endpoints
        String fromLoc = row.get("from_stop") != null ? (String) row.get("from_stop") : (String) row.get("start_location");
        String toLoc = row.get("to_stop") != null ? (String) row.get("to_stop") : (String) row.get("end_location");

        return new BookingConfirmationResult(
                (String) row.get("booking_reference"),
                (String) row.get("status"),
                (String) row.get("transaction_id"),
                (String) row.get("seat_number"),
                toBigDecimal(row.get("total_amount")),
                (String) row.get("bus_number"),
                fromLoc,
                toLoc,
                row.get("journey_date") != null ? row.get("journey_date").toString() : null,
                formatTime(row.get("journey_time"))
        );
    }

    /*
       7. Cancel booking by reference
    */
    @Transactional
    public void cancelBooking(String bookingRef) {
        int updated = jdbc.update(
            "UPDATE seat_booking SET status = 'cancelled' WHERE booking_reference = ? AND status = 'confirmed'",
            bookingRef
        );
        if (updated == 0) {
            throw new RuntimeException("Booking not found or already cancelled");
        }
    }

    public void markPassengerBoarded(Long seatBookingId) {
        int updated = jdbc.update(
            "UPDATE seat_booking SET status = 'boarded' WHERE seat_booking_id = ? AND status != 'cancelled'",
            seatBookingId
        );
        if (updated == 0) {
            throw new RuntimeException("Booking not found or already cancelled");
        }
    }

    private void validateBookableJourneyDate(String journeyDate) {
        LocalDate parsedDate;
        try {
            parsedDate = LocalDate.parse(journeyDate);
        } catch (DateTimeParseException | NullPointerException ex) {
            throw new BusinessException("Journey date is invalid. Please choose today or a future date.");
        }

        LocalDate today = LocalDate.now(APP_ZONE);
        if (parsedDate.isBefore(today)) {
            throw new BusinessException("Bookings can only be made for today or a future date.");
        }
    }


    /*
       HELPERS
    */

    /**
     * Converts a stop's offset from the route origin into minutes. Explicit ETA
     * wins, then distance, then ordered stop priority when admin only saved stops.
     */
    private int resolveArrivalMins(
            Object arrivalObj,
            Object distanceObj,
            Object priorityObj,
            int firstPriority,
            int lastPriority,
            int totalDurationMins,
            double totalDistance
    ) {
        int arrivalMins = arrivalObj != null ? ((Number) arrivalObj).intValue() : -1;
        int priority = priorityObj != null ? ((Number) priorityObj).intValue() : firstPriority;
        boolean firstStop = priority == firstPriority;
        boolean missingOffset = arrivalObj == null || (arrivalMins == 0 && !firstStop);

        if (missingOffset
                && totalDurationMins > 0
                && totalDistance > 0
                && distanceObj != null) {
            double distance = ((Number) distanceObj).doubleValue();
            if (distance > 0) {
                return (int) Math.round((distance / totalDistance) * totalDurationMins);
            }
        }

        if (missingOffset && totalDurationMins > 0 && lastPriority > firstPriority) {
            double ratio = (double) (priority - firstPriority) / (double) (lastPriority - firstPriority);
            ratio = Math.max(0.0, Math.min(1.0, ratio));
            return (int) Math.round(ratio * totalDurationMins);
        }

        return Math.max(0, arrivalMins);
    }

    private int firstPriority(List<Map<String, Object>> stopRows) {
        if (stopRows == null || stopRows.isEmpty()) {
            return 1;
        }
        return ((Number) stopRows.get(0).get("priority")).intValue();
    }

    private int lastPriority(List<Map<String, Object>> stopRows) {
        if (stopRows == null || stopRows.isEmpty()) {
            return 1;
        }
        return ((Number) stopRows.get(stopRows.size() - 1).get("priority")).intValue();
    }

    private Map<String, Object> findStopRow(List<Map<String, Object>> stopRows, String stopName) {
        String normalized = normalizeStopKey(stopName);
        if (normalized.isBlank()) {
            return null;
        }
        return stopRows.stream()
                .filter(row -> normalized.equals(normalizeStopKey((String) row.get("name"))))
                .findFirst()
                .orElse(null);
    }

    private String buildRouteLabel(String start, String end) {
        String cleanStart = stringValue(start);
        String cleanEnd = stringValue(end);
        if (cleanStart.isBlank()) {
            return cleanEnd;
        }
        if (cleanEnd.isBlank()) {
            return cleanStart;
        }
        return cleanStart + " to " + cleanEnd;
    }

    private String resolveBusRouteName(String dbRouteName, String routeStart, String routeEnd, String segmentStart, String segmentEnd) {
        String endpointLabel = buildRouteLabel(routeStart, routeEnd);
        String cleanRouteName = stringValue(dbRouteName);
        if (!cleanRouteName.isBlank()
                && !isSameStopPairLabel(cleanRouteName, segmentStart, segmentEnd)) {
            return cleanRouteName;
        }
        return endpointLabel;
    }

    private boolean isSameStopPairLabel(String label, String start, String end) {
        String normalizedLabel = normalizeStopKey(label.replace("->", " ").replace(" to ", " "));
        String normalizedDashPair = normalizeStopKey(stringValue(start) + stringValue(end));
        String normalizedReverseDashPair = normalizeStopKey(stringValue(end) + stringValue(start));
        return !normalizedDashPair.isBlank()
                && (normalizedLabel.equals(normalizedDashPair)
                    || normalizedLabel.equals(normalizedReverseDashPair));
    }

    private String stringValue(Object value) {
        return value == null ? "" : value.toString().trim();
    }

    private String formatDistance(BigDecimal distance) {
        if (distance == null) {
            return null;
        }
        return distance.stripTrailingZeros().toPlainString() + " km";
    }

    private String formatDuration(int totalMins) {
        int hours = totalMins / 60;
        int mins = totalMins % 60;
        return (hours > 0 ? hours + "h " : "") + mins + "m";
    }

    /**
     * Calculate proportional fare from a search result row that already
     * contains from_distance, to_distance, total_distance, and route_fee.
     */
    private BigDecimal calculateSegmentFare(Map<String, Object> row) {
        BigDecimal routeFee = toBigDecimal(row.get("route_fee"));
        BigDecimal totalDistance = toBigDecimal(row.get("total_distance"));
        BigDecimal fromDist = toBigDecimal(row.get("from_distance"));
        BigDecimal toDist = toBigDecimal(row.get("to_distance"));

        if (totalDistance == null || totalDistance.compareTo(BigDecimal.ZERO) <= 0) return routeFee;
        if (fromDist == null || toDist == null) return routeFee;

        BigDecimal segmentDistance = toDist.subtract(fromDist).abs();
        if (segmentDistance.compareTo(BigDecimal.ZERO) <= 0) return routeFee;
        //segment caculation
        return segmentDistance
                .divide(totalDistance, 10, java.math.RoundingMode.HALF_UP)
                .multiply(routeFee)
                .setScale(2, java.math.RoundingMode.HALF_UP);
    }

    /*
      Calculate proportional fare for a given route by looking up from/to stop distances.
    */
    private BigDecimal calculateSegmentFareForRoute(Long routeId, BigDecimal routeFee,
                                                     BigDecimal totalDistance,
                                                     String fromStop, String toStop) {
        if (totalDistance == null || totalDistance.compareTo(BigDecimal.ZERO) <= 0) {
            return routeFee;
        }

        String stopSql = """
            SELECT distance_from_start
            FROM route_stop
            WHERE route_id = ?
              AND LOWER(REPLACE(REPLACE(TRIM(name), '-', ''), ' ', '')) = ?
            ORDER BY priority
            LIMIT 1
            """;

        String normalizedFrom = normalizeStopKey(fromStop);
        String normalizedTo = normalizeStopKey(toStop);

        List<BigDecimal> fromDistances = jdbc.queryForList(stopSql, BigDecimal.class, routeId, normalizedFrom);
        List<BigDecimal> toDistances = jdbc.queryForList(stopSql, BigDecimal.class, routeId, normalizedTo);

        if (fromDistances.isEmpty() || toDistances.isEmpty()) {
            return routeFee;
        }

        BigDecimal fromDist = fromDistances.get(0);
        BigDecimal toDist = toDistances.get(0);
        if (fromDist == null || toDist == null) return routeFee;
        BigDecimal segmentDistance = toDist.subtract(fromDist).abs();

        if (segmentDistance.compareTo(BigDecimal.ZERO) <= 0) return routeFee;
        //calculation ticket ticket
        return segmentDistance
                .divide(totalDistance, 10, java.math.RoundingMode.HALF_UP)
                .multiply(routeFee)
                .setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private int countBookedSeats(Long busId, String date) {
        String sql = "SELECT COALESCE(SUM(LENGTH(seat_number) - LENGTH(REPLACE(seat_number, ',', '')) + 1), 0) " +
                     "FROM seat_booking WHERE bus_id = ? AND journey_date = ? AND status != 'cancelled'";
        return jdbc.queryForObject(sql, Integer.class, busId, date);
    }

    private List<SeatLayoutRow> generateDefaultLayout(int seatCapacity) {
        List<SeatLayoutRow> rows = new ArrayList<>();
        int lastRowSize = 5;
        if (seatCapacity <= 20) lastRowSize = 3;
        else if (seatCapacity <= 30) lastRowSize = 4;

        int regularSeats = seatCapacity - lastRowSize;
        if (regularSeats % 4 != 0) {
            lastRowSize = seatCapacity % 4 == 0 ? 4 : (seatCapacity % 4) + 4;
            if (lastRowSize > seatCapacity) lastRowSize = seatCapacity;
            regularSeats = seatCapacity - lastRowSize;
        }
        int regularRows = regularSeats / 4;

        for (int r = 1; r <= regularRows; r++) {
            rows.add(new SeatLayoutRow(
                    r,
                    List.of(r + "A", r + "B"),
                    List.of(r + "C", r + "D"),
                    null
            ));
        }

        if (lastRowSize > 0) {
            int lastRowNum = regularRows + 1;
            String[] cols = {"A", "B", "C", "D", "E", "F"};
            List<String> lastSeats = new ArrayList<>();
            for (int i = 0; i < lastRowSize && i < cols.length; i++) {
                lastSeats.add(lastRowNum + cols[i]);
            }
            rows.add(new SeatLayoutRow(lastRowNum, List.of(), List.of(), lastSeats));
        }

        return rows;
    }

    @SuppressWarnings("unchecked")
    private List<String> parseAmenities(Object amenitiesObj) {
        if (amenitiesObj == null) return List.of();
        try {
            String json = amenitiesObj.toString();
            return mapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private String formatTime(Object timeObj) {
        if (timeObj == null) return "";
        if (timeObj instanceof Time t) {
            return t.toLocalTime().format(DateTimeFormatter.ofPattern("HH:mm"));
        }
        if (timeObj instanceof LocalTime lt) {
            return lt.format(DateTimeFormatter.ofPattern("HH:mm"));
        }
        return timeObj.toString();
    }

    /** Convert "hh:mm a" (12-hr) to "HH:mm" (24-hr) */
    private String convertTo24Hr(String time12) {
        try {
            LocalTime lt = LocalTime.parse(time12.trim(), DateTimeFormatter.ofPattern("hh:mm a"));
            return lt.format(DateTimeFormatter.ofPattern("HH:mm"));
        } catch (Exception e) {
            return time12; // return as-is if parsing fails
        }
    }

    private LocalTime toLocalTime(Object timeObj) {
        if (timeObj instanceof Time t) return t.toLocalTime();
        if (timeObj instanceof LocalTime lt) return lt;
        if (timeObj instanceof String s) return LocalTime.parse(s);
        return LocalTime.of(0, 0);
    }

    private BigDecimal toBigDecimal(Object obj) {
        if (obj == null) return BigDecimal.ZERO;
        if (obj instanceof BigDecimal bd) return bd;
        return new BigDecimal(obj.toString());
    }

    private BigDecimal toNullableBigDecimal(Object obj) {
        if (obj == null) return null;
        if (obj instanceof BigDecimal bd) return bd;
        return new BigDecimal(obj.toString());
    }

    private Double toDouble(Object obj) {
        if (obj == null) return 0.0;
        if (obj instanceof Number n) return n.doubleValue();
        return Double.parseDouble(obj.toString());
    }

    private String normalizeStopKey(String value) {
        if (value == null) {
            return "";
        }
        return value.trim()
                .toLowerCase(Locale.ROOT)
                .replace("-", "")
                .replace(" ", "");
    }

    /**
     * Returns:
     *  1 when from-stop appears after to-stop (reverse direction),
     * -1 when from-stop appears before to-stop (forward direction),
     *  0 when either stop is not found or they are equal.
     */
    private int compareStopPriority(Long routeId, String fromStop, String toStop) {
        if (routeId == null || fromStop == null || toStop == null
                || fromStop.isBlank() || toStop.isBlank()) {
            return 0;
        }

        String prioritySql = """
            SELECT priority
            FROM route_stop
            WHERE route_id = ?
              AND LOWER(REPLACE(REPLACE(TRIM(name), '-', ''), ' ', '')) = ?
            ORDER BY priority
            LIMIT 1
            """;

        String normalizedFrom = normalizeStopKey(fromStop);
        String normalizedTo = normalizeStopKey(toStop);

        List<Integer> fromPriorities = jdbc.queryForList(prioritySql, Integer.class, routeId, normalizedFrom);
        List<Integer> toPriorities = jdbc.queryForList(prioritySql, Integer.class, routeId, normalizedTo);
        if (fromPriorities.isEmpty() || toPriorities.isEmpty()) {
            return 0;
        }

        int fromPriority = fromPriorities.get(0);
        int toPriority = toPriorities.get(0);
        return Integer.compare(fromPriority, toPriority);
    }

    private void ensurePassengerExists(Long userId) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM passenger WHERE passenger_id = ?", Integer.class, userId);
        if (count == null || count == 0) {
            String placeholder = "000-" + userId;
            jdbc.update("INSERT INTO passenger (passenger_id, mobile_number, status) VALUES (?, ?, 'active')",
                    userId, placeholder);
        }
    }
}
