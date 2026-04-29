package com.trackngo.booking.internal.service;

import com.trackngo.booking.api.dto.PromotionDtos.*;
import com.trackngo.booking.internal.entity.promotion.Promotion.DiscountType;
import com.trackngo.booking.internal.entity.promotion.Promotion.TargetType;
import com.trackngo.commons.exception.BusinessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
public class PromotionService {

    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

    private final JdbcTemplate jdbc;

    /** Creates the promotion service with JDBC-based persistence access. */
    public PromotionService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Returns promotions ordered for the admin dashboard after closing exhausted promotions. */
    public List<PromotionSummary> listPromotions() {
        endPromotionsThatReachedLimit();
        return jdbc.query("""
            SELECT promotion_id, name, description, target_type, discount_type, discount_value,
                   promo_code, regular_customer_min_completed_bookings, max_bookings,
                   used_bookings, status, created_at, updated_at
            FROM promotion
            ORDER BY
              CASE status WHEN 'ACTIVE' THEN 0 WHEN 'ENDED' THEN 1 ELSE 2 END,
              created_at DESC
            """, summaryMapper());
    }

    /** Normalizes and persists a new promotion, then returns the stored summary. */
    @Transactional
    public PromotionSummary createPromotion(SavePromotionRequest request) {
        PromotionInput input = normalize(request);
        jdbc.update("""
            INSERT INTO promotion
              (name, description, target_type, discount_type, discount_value, promo_code,
               regular_customer_min_completed_bookings, max_bookings, used_bookings,
               status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'ACTIVE', ?, ?)
            """,
                input.name(),
                input.description(),
                input.targetType().name(),
                input.discountType().name(),
                input.discountValue(),
                input.promoCode(),
                input.regularCustomerMinCompletedBookings(),
                input.maxBookings(),
                LocalDateTime.now(),
                LocalDateTime.now()
        );
        Long id = jdbc.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
        return getPromotion(id);
    }

    /** Updates a promotion, restoring ended promotions when capacity becomes available again. */
    @Transactional
    public PromotionSummary updatePromotion(Long promotionId, SavePromotionRequest request) {
        ensurePromotionExists(promotionId);
        PromotionInput input = normalize(request);
        jdbc.update("""
            UPDATE promotion
            SET name = ?, description = ?, target_type = ?, discount_type = ?, discount_value = ?,
                promo_code = ?, regular_customer_min_completed_bookings = ?, max_bookings = ?,
                status = CASE
                    WHEN status = 'ENDED' AND (max_bookings IS NULL OR used_bookings < ?) THEN 'ACTIVE'
                    ELSE status
                END,
                updated_at = ?
            WHERE promotion_id = ?
            """,
                input.name(),
                input.description(),
                input.targetType().name(),
                input.discountType().name(),
                input.discountValue(),
                input.promoCode(),
                input.regularCustomerMinCompletedBookings(),
                input.maxBookings(),
                input.maxBookings(),
                LocalDateTime.now(),
                promotionId
        );
        endPromotionsThatReachedLimit();
        return getPromotion(promotionId);
    }

    /** Cancels a promotion so it can no longer be applied to bookings. */
    @Transactional
    public PromotionSummary cancelPromotion(Long promotionId) {
        ensurePromotionExists(promotionId);
        jdbc.update("""
            UPDATE promotion
            SET status = 'CANCELLED', updated_at = ?
            WHERE promotion_id = ?
            """, LocalDateTime.now(), promotionId);
        return getPromotion(promotionId);
    }

    /** Deletes a promotion only when it is no longer active. */
    @Transactional
    public void deleteInactivePromotion(Long promotionId) {
        ensurePromotionExists(promotionId);
        Integer activeCount = jdbc.queryForObject("""
            SELECT COUNT(*)
            FROM promotion
            WHERE promotion_id = ? AND status = 'ACTIVE'
            """, Integer.class, promotionId);
        if (activeCount != null && activeCount > 0) {
            throw new BusinessException("Active promotions cannot be removed. Cancel the promotion first.");
        }

        jdbc.update("DELETE FROM promotion_redemption WHERE promotion_id = ?", promotionId);
        jdbc.update("DELETE FROM promotion WHERE promotion_id = ?", promotionId);
    }

    /** Quotes promotions from the API request payload used by the booking flow. */
    public PromotionQuoteResult quote(PromotionQuoteRequest request) {
        return quote(
                request.passengerId(),
                request.busId(),
                request.fromLocation(),
                request.toLocation(),
                requireAmount(request.originalAmount()),
                request.promoCode(),
                true
        );
    }

    /** Quotes promotions directly from booking data that has already been resolved elsewhere. */
    public PromotionQuoteResult quoteForBooking(Long passengerId, Long busId, String fromLocation, String toLocation,
                                                BigDecimal originalAmount, String promoCode, boolean applyAutomatic) {
        return quote(passengerId, busId, fromLocation, toLocation, requireAmount(originalAmount), promoCode, applyAutomatic);
    }

    /** Marks a promotion as used for a completed booking and records the redemption. */
    @Transactional
    public void redeem(Long promotionId, Long passengerId, String bookingReference, BigDecimal discountAmount) {
        if (promotionId == null) {
            return;
        }

        int updated = jdbc.update("""
            UPDATE promotion
            SET used_bookings = used_bookings + 1, updated_at = ?
            WHERE promotion_id = ?
              AND status = 'ACTIVE'
              AND (max_bookings IS NULL OR used_bookings < max_bookings)
            """, LocalDateTime.now(), promotionId);
        if (updated == 0) {
            throw new BusinessException("Promotion is no longer available.");
        }

        jdbc.update("""
            INSERT INTO promotion_redemption
              (promotion_id, passenger_id, booking_reference, discount_amount, created_at)
            VALUES (?, ?, ?, ?, ?)
            """, promotionId, passengerId, bookingReference, discountAmount, LocalDateTime.now());

        endPromotionsThatReachedLimit();
    }

    /** Evaluates promotion eligibility and returns the best applicable discount result. */
    private PromotionQuoteResult quote(Long passengerId, Long busId, String fromLocation, String toLocation,
                                       BigDecimal originalAmount, String promoCode, boolean applyAutomatic) {
        endPromotionsThatReachedLimit();

        String busType = findBusType(busId);
        int completedBookings = countCompletedSeatBookings(passengerId);
        String normalizedCode = normalizeCode(promoCode);

        List<PromotionSummary> eligiblePromotions = listActivePromotions().stream()
                .filter(p -> p.targetType().equals(TargetType.PROMO_CODE.name()) == (normalizedCode != null))
                .filter(p -> normalizedCode == null || normalizedCode.equals(normalizeCode(p.promoCode())))
                .filter(p -> isEligible(p, busType, completedBookings, normalizedCode))
                .toList();

        PromotionSummary selected = null;
        if (normalizedCode != null) {
            selected = eligiblePromotions.stream().findFirst().orElseThrow(() ->
                    new BusinessException("Promo code is invalid, expired, or not eligible for this booking."));
        } else if (applyAutomatic) {
            selected = eligiblePromotions.stream()
                    .max(Comparator.comparing(p -> discountAmount(p, originalAmount)))
                    .orElse(null);
        }

        BigDecimal discount = selected != null
                ? discountAmount(selected, originalAmount)
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        BigDecimal finalAmount = originalAmount.subtract(discount).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);

        String message = selected != null
                ? "Promotion applied"
                : "No eligible promotion found for this booking.";

        return new PromotionQuoteResult(
                selected != null ? selected.promotionId() : null,
                selected != null ? selected.name() : null,
                selected != null ? selected.targetType() : null,
                selected != null ? selected.discountType() : null,
                selected != null ? selected.discountValue() : null,
                selected != null ? selected.promoCode() : normalizedCode,
                originalAmount,
                discount,
                finalAmount,
                message,
                eligiblePromotions
        );
    }

    /** Returns only promotions that are currently active and still have remaining capacity. */
    private List<PromotionSummary> listActivePromotions() {
        return jdbc.query("""
            SELECT promotion_id, name, description, target_type, discount_type, discount_value,
                   promo_code, regular_customer_min_completed_bookings, max_bookings,
                   used_bookings, status, created_at, updated_at
            FROM promotion
            WHERE status = 'ACTIVE'
              AND (max_bookings IS NULL OR used_bookings < max_bookings)
            ORDER BY created_at DESC
            """, summaryMapper());
    }

    /** Loads a single promotion summary by its identifier. */
    private PromotionSummary getPromotion(Long promotionId) {
        return jdbc.queryForObject("""
            SELECT promotion_id, name, description, target_type, discount_type, discount_value,
                   promo_code, regular_customer_min_completed_bookings, max_bookings,
                   used_bookings, status, created_at, updated_at
            FROM promotion
            WHERE promotion_id = ?
            """, summaryMapper(), promotionId);
    }

    /** Ensures that a promotion exists before performing update or delete work. */
    private void ensurePromotionExists(Long promotionId) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM promotion WHERE promotion_id = ?",
                Integer.class,
                promotionId
        );
        if (count == null || count == 0) {
            throw new BusinessException("Promotion not found.");
        }
    }

    /** Checks whether the promotion rules match the current booking context. */
    private boolean isEligible(PromotionSummary promotion, String busType, int completedBookings, String promoCode) {
        TargetType target = TargetType.valueOf(promotion.targetType());
        return switch (target) {
            case HIGHWAY -> "highway".equalsIgnoreCase(busType);
            case LONG_DISTANCE -> "long_distance".equalsIgnoreCase(busType);
            case HIGHWAY_AND_LONG_DISTANCE -> "highway".equalsIgnoreCase(busType) || "long_distance".equalsIgnoreCase(busType);
            case REGULAR_CUSTOMERS -> completedBookings > Objects.requireNonNullElse(promotion.regularCustomerMinCompletedBookings(), 10);
            case PROMO_CODE -> promoCode != null && promoCode.equals(normalizeCode(promotion.promoCode()));
        };
    }

    /** Calculates the discount amount and keeps it within the original booking amount. */
    private BigDecimal discountAmount(PromotionSummary promotion, BigDecimal originalAmount) {
        DiscountType discountType = DiscountType.valueOf(promotion.discountType());
        BigDecimal discount = switch (discountType) {
            case PERCENTAGE -> originalAmount
                    .multiply(promotion.discountValue())
                    .divide(ONE_HUNDRED, 2, RoundingMode.HALF_UP);
            case FIXED_AMOUNT -> promotion.discountValue().setScale(2, RoundingMode.HALF_UP);
        };
        if (discount.compareTo(BigDecimal.ZERO) < 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        if (discount.compareTo(originalAmount) > 0) {
            return originalAmount.setScale(2, RoundingMode.HALF_UP);
        }
        return discount.setScale(2, RoundingMode.HALF_UP);
    }

    /** Loads the bus type required to evaluate route-based promotion targets. */
    private String findBusType(Long busId) {
        if (busId == null || busId <= 0) {
            throw new BusinessException("Bus is required to evaluate promotions.");
        }
        List<String> busTypes = jdbc.queryForList("SELECT bus_type FROM bus WHERE bus_id = ?", String.class, busId);
        if (busTypes.isEmpty()) {
            throw new BusinessException("Bus not found.");
        }
        return busTypes.get(0);
    }

    /** Counts completed seat bookings for regular-customer promotion checks. */
    private int countCompletedSeatBookings(Long passengerId) {
        if (passengerId == null || passengerId <= 0) {
            return 0;
        }
        Integer count = jdbc.queryForObject("""
            SELECT COUNT(*)
            FROM seat_booking
            WHERE passenger_id = ? AND status = 'completed'
            """, Integer.class, passengerId);
        return count != null ? count : 0;
    }

    /** Automatically ends promotions that have reached their booking limit. */
    private void endPromotionsThatReachedLimit() {
        jdbc.update("""
            UPDATE promotion
            SET status = 'ENDED', updated_at = ?
            WHERE status = 'ACTIVE'
              AND max_bookings IS NOT NULL
              AND used_bookings >= max_bookings
            """, LocalDateTime.now());
    }

    /** Validates and normalizes incoming promotion data before it is stored. */
    private PromotionInput normalize(SavePromotionRequest request) {
        if (request == null) {
            throw new BusinessException("Promotion payload is required.");
        }

        String name = request.name() != null ? request.name().trim() : "";
        if (name.isBlank()) {
            throw new BusinessException("Promotion name is required.");
        }

        TargetType targetType = parseTargetType(request.targetType());
        DiscountType discountType = parseDiscountType(request.discountType());
        BigDecimal discountValue = requireAmount(request.discountValue());
        if (discountType == DiscountType.PERCENTAGE && discountValue.compareTo(ONE_HUNDRED) > 0) {
            throw new BusinessException("Percentage discount cannot be greater than 100.");
        }

        String promoCode = normalizeCode(request.promoCode());
        if (targetType == TargetType.PROMO_CODE && promoCode == null) {
            throw new BusinessException("Promo code is required for promo-code promotions.");
        }
        if (targetType != TargetType.PROMO_CODE) {
            promoCode = null;
        }

        Integer threshold = request.regularCustomerMinCompletedBookings();
        if (targetType == TargetType.REGULAR_CUSTOMERS) {
            threshold = threshold != null ? threshold : 10;
            if (threshold < 0) {
                throw new BusinessException("Regular customer booking threshold cannot be negative.");
            }
        } else {
            threshold = null;
        }

        Integer maxBookings = request.maxBookings();
        if (maxBookings == null || maxBookings <= 0) {
            throw new BusinessException("Maximum booking amount must be greater than 0.");
        }

        String description = request.description() != null ? request.description().trim() : "";

        return new PromotionInput(
                name,
                description,
                targetType,
                discountType,
                discountValue.setScale(2, RoundingMode.HALF_UP),
                promoCode,
                threshold,
                maxBookings
        );
    }

    /** Parses target type aliases used by the admin UI into the backend enum. */
    private TargetType parseTargetType(String raw) {
        String normalized = normalizeEnum(raw);
        for (Map.Entry<String, TargetType> alias : Map.of(
                "HIGHWAY_USERS", TargetType.HIGHWAY,
                "LONG_DISTANCE_USERS", TargetType.LONG_DISTANCE,
                "BOTH", TargetType.HIGHWAY_AND_LONG_DISTANCE,
                "PROMO", TargetType.PROMO_CODE,
                "CODE", TargetType.PROMO_CODE
        ).entrySet()) {
            if (alias.getKey().equals(normalized)) {
                return alias.getValue();
            }
        }
        try {
            return TargetType.valueOf(normalized);
        } catch (Exception ex) {
            throw new BusinessException("Unknown promotion target type.");
        }
    }

    /** Parses discount type aliases used by the admin UI into the backend enum. */
    private DiscountType parseDiscountType(String raw) {
        String normalized = normalizeEnum(raw);
        if ("FIXED".equals(normalized) || "AMOUNT".equals(normalized)) {
            return DiscountType.FIXED_AMOUNT;
        }
        try {
            return DiscountType.valueOf(normalized);
        } catch (Exception ex) {
            throw new BusinessException("Unknown discount type.");
        }
    }

    /** Normalizes enum-like request values into uppercase underscore format. */
    private String normalizeEnum(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BusinessException("Promotion type is required.");
        }
        return raw.trim()
                .replace('-', '_')
                .replace(' ', '_')
                .toUpperCase(Locale.ROOT);
    }

    /** Trims and uppercases promo codes so comparisons stay consistent. */
    private String normalizeCode(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return raw.trim().toUpperCase(Locale.ROOT);
    }

    /** Ensures a monetary amount exists and is greater than zero. */
    private BigDecimal requireAmount(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("Amount must be greater than 0.");
        }
        return amount.setScale(2, RoundingMode.HALF_UP);
    }

    /** Maps a JDBC row into the promotion summary DTO returned by this module. */
    private RowMapper<PromotionSummary> summaryMapper() {
        return (rs, rowNum) -> new PromotionSummary(
                rs.getLong("promotion_id"),
                rs.getString("name"),
                rs.getString("description"),
                rs.getString("target_type"),
                rs.getString("discount_type"),
                rs.getBigDecimal("discount_value"),
                rs.getString("promo_code"),
                (Integer) rs.getObject("regular_customer_min_completed_bookings"),
                (Integer) rs.getObject("max_bookings"),
                (Integer) rs.getObject("used_bookings"),
                rs.getString("status"),
                toLocalDateTime(rs.getTimestamp("created_at")),
                toLocalDateTime(rs.getTimestamp("updated_at"))
        );
    }

    /** Converts SQL timestamps into LocalDateTime values used by the DTOs. */
    private LocalDateTime toLocalDateTime(Timestamp timestamp) {
        return timestamp != null ? timestamp.toLocalDateTime() : null;
    }

    private record PromotionInput(
            String name,
            String description,
            TargetType targetType,
            DiscountType discountType,
            BigDecimal discountValue,
            String promoCode,
            Integer regularCustomerMinCompletedBookings,
            Integer maxBookings
    ) {}
}
