package com.trackngo.booking.internal.service;

import com.trackngo.booking.api.dto.PromotionDtos.PromotionQuoteRequest;
import com.trackngo.booking.api.dto.PromotionDtos.PromotionQuoteResult;
import com.trackngo.booking.api.dto.PromotionDtos.PromotionSummary;
import com.trackngo.booking.api.dto.PromotionDtos.SavePromotionRequest;
import com.trackngo.commons.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PromotionServiceTest {

    @Mock
    private JdbcTemplate jdbc;

    @InjectMocks
    private PromotionService service;

    /** Verifies that promotion creation normalizes admin input before persisting the promotion. */
    @Test
    void createPromotionShouldNormalizePromoCodePromotion() {
        SavePromotionRequest request = new SavePromotionRequest(
            "  Summer Saver  ",
            "  Save on your next ride  ",
            "promo",
            "fixed",
            new BigDecimal("250"),
            " save25 ",
            null,
            100
        );

        PromotionSummary savedPromotion = buildPromotionSummary(
            42L,
            "Summer Saver",
            "Save on your next ride",
            "PROMO_CODE",
            "FIXED_AMOUNT",
            new BigDecimal("250.00"),
            "SAVE25",
            null,
            100,
            0,
            "ACTIVE"
        );

        when(jdbc.queryForObject("SELECT LAST_INSERT_ID()", Long.class)).thenReturn(42L);
        when(jdbc.queryForObject(startsWith("SELECT promotion_id"), any(RowMapper.class), eq(42L)))
            .thenReturn(savedPromotion);

        PromotionSummary created = service.createPromotion(request);

        assertEquals(savedPromotion, created);
        verify(jdbc).update(
            startsWith("INSERT INTO promotion"),
            eq("Summer Saver"),
            eq("Save on your next ride"),
            eq("PROMO_CODE"),
            eq("FIXED_AMOUNT"),
            eq(new BigDecimal("250.00")),
            eq("SAVE25"),
            eq(null),
            eq(100),
            any(LocalDateTime.class),
            any(LocalDateTime.class)
        );
    }

    /** Verifies that promo-code promotions cannot be created without a promo code. */
    @Test
    void createPromotionShouldRejectMissingPromoCode() {
        SavePromotionRequest request = new SavePromotionRequest(
            "Summer Saver",
            "Save on your next ride",
            "promo_code",
            "percentage",
            new BigDecimal("15"),
            "   ",
            null,
            50
        );

        BusinessException exception = assertThrows(BusinessException.class, () -> service.createPromotion(request));

        assertEquals("Promo code is required for promo-code promotions.", exception.getMessage());
        verify(jdbc, never()).queryForObject("SELECT LAST_INSERT_ID()", Long.class);
    }

    /** Verifies that active promotions must be cancelled before they can be deleted. */
    @Test
    void deleteInactivePromotionShouldRejectActivePromotion() {
        when(jdbc.queryForObject(startsWith("SELECT COUNT(*)"), eq(Integer.class), eq(55L))).thenReturn(1);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.deleteInactivePromotion(55L));

        assertEquals("Active promotions cannot be removed. Cancel the promotion first.", exception.getMessage());
        verify(jdbc, never()).update("DELETE FROM promotion WHERE promotion_id = ?", 55L);
    }

    /** Verifies that automatic quoting selects the promotion with the largest discount. */
    @Test
    void quoteShouldApplyBestEligibleAutomaticPromotion() {
        PromotionSummary percentagePromotion = buildPromotionSummary(
            11L,
            "Highway Ten Percent",
            "10 percent off",
            "HIGHWAY",
            "PERCENTAGE",
            new BigDecimal("10.00"),
            null,
            null,
            100,
            0,
            "ACTIVE"
        );
        PromotionSummary fixedPromotion = buildPromotionSummary(
            12L,
            "Highway Flat Discount",
            "Flat amount off",
            "HIGHWAY",
            "FIXED_AMOUNT",
            new BigDecimal("350.00"),
            null,
            null,
            100,
            0,
            "ACTIVE"
        );

        when(jdbc.queryForList("SELECT bus_type FROM bus WHERE bus_id = ?", String.class, 7L)).thenReturn(List.of("highway"));
        when(jdbc.queryForObject(startsWith("SELECT COUNT(*)"), eq(Integer.class), eq(15L))).thenReturn(3);
        when(jdbc.query(startsWith("SELECT promotion_id"), any(RowMapper.class)))
            .thenReturn(List.of(percentagePromotion, fixedPromotion));

        PromotionQuoteResult result = service.quote(new PromotionQuoteRequest(
            15L,
            7L,
            "Colombo",
            "Kandy",
            new BigDecimal("1000.00"),
            null
        ));

        assertEquals(12L, result.promotionId());
        assertEquals("Highway Flat Discount", result.name());
        assertEquals(new BigDecimal("350.00"), result.discountAmount());
        assertEquals(new BigDecimal("650.00"), result.finalAmount());
        assertEquals("Promotion applied", result.message());
        assertEquals(2, result.eligiblePromotions().size());
    }

    /** Verifies that invalid promo codes are rejected when no eligible promotion matches the code. */
    @Test
    void quoteShouldRejectInvalidPromoCode() {
        PromotionSummary promoCodePromotion = buildPromotionSummary(
            13L,
            "Save Twenty",
            "Promo code discount",
            "PROMO_CODE",
            "PERCENTAGE",
            new BigDecimal("20.00"),
            "SAVE20",
            null,
            100,
            0,
            "ACTIVE"
        );

        when(jdbc.queryForList("SELECT bus_type FROM bus WHERE bus_id = ?", String.class, 7L)).thenReturn(List.of("highway"));
        when(jdbc.queryForObject(startsWith("SELECT COUNT(*)"), eq(Integer.class), eq(15L))).thenReturn(3);
        when(jdbc.query(startsWith("SELECT promotion_id"), any(RowMapper.class)))
            .thenReturn(List.of(promoCodePromotion));

        BusinessException exception = assertThrows(
            BusinessException.class,
            () -> service.quote(new PromotionQuoteRequest(
                15L,
                7L,
                "Colombo",
                "Kandy",
                new BigDecimal("1000.00"),
                "wrong-code"
            ))
        );

        assertEquals("Promo code is invalid, expired, or not eligible for this booking.", exception.getMessage());
    }

    /** Verifies that successful redemption increments usage and creates a redemption record. */
    @Test
    void redeemShouldStorePromotionRedemption() {
        when(jdbc.update(startsWith("UPDATE promotion"), any(LocalDateTime.class), eq(12L))).thenReturn(1);

        service.redeem(12L, 15L, "BK-1001", new BigDecimal("120.00"));

        verify(jdbc).update(
            startsWith("INSERT INTO promotion_redemption"),
            eq(12L),
            eq(15L),
            eq("BK-1001"),
            eq(new BigDecimal("120.00")),
            any(LocalDateTime.class)
        );
    }

    /** Verifies that redemption fails when the promotion can no longer be updated as active. */
    @Test
    void redeemShouldThrowWhenPromotionIsUnavailable() {
        when(jdbc.update(startsWith("UPDATE promotion"), any(LocalDateTime.class), eq(12L))).thenReturn(0);

        BusinessException exception = assertThrows(
            BusinessException.class,
            () -> service.redeem(12L, 15L, "BK-1001", new BigDecimal("120.00"))
        );

        assertEquals("Promotion is no longer available.", exception.getMessage());
        verify(jdbc, never()).update(startsWith("INSERT INTO promotion_redemption"), any(), any(), any(), any(), any());
    }

    /** Builds a promotion summary fixture used by the promotion service tests. */
    private PromotionSummary buildPromotionSummary(
        Long promotionId,
        String name,
        String description,
        String targetType,
        String discountType,
        BigDecimal discountValue,
        String promoCode,
        Integer regularCustomerMinCompletedBookings,
        Integer maxBookings,
        Integer usedBookings,
        String status
    ) {
        return new PromotionSummary(
            promotionId,
            name,
            description,
            targetType,
            discountType,
            discountValue,
            promoCode,
            regularCustomerMinCompletedBookings,
            maxBookings,
            usedBookings,
            status,
            LocalDateTime.of(2026, 4, 25, 10, 0),
            LocalDateTime.of(2026, 4, 25, 10, 0)
        );
    }
}
