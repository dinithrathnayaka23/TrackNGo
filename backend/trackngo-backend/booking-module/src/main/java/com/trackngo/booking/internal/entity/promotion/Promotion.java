package com.trackngo.booking.internal.entity.promotion;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "promotion")
public class Promotion {

    public enum TargetType {
        HIGHWAY,
        LONG_DISTANCE,
        HIGHWAY_AND_LONG_DISTANCE,
        REGULAR_CUSTOMERS,
        PROMO_CODE
    }

    public enum DiscountType {
        PERCENTAGE,
        FIXED_AMOUNT
    }

    public enum Status {
        ACTIVE,
        CANCELLED,
        ENDED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "promotion_id")
    private Long promotionId;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 40)
    private TargetType targetType;

    @Enumerated(EnumType.STRING)
    @Column(name = "discount_type", nullable = false, length = 30)
    private DiscountType discountType;

    @Column(name = "discount_value", nullable = false, precision = 10, scale = 2)
    private BigDecimal discountValue;

    @Column(name = "promo_code", unique = true, length = 60)
    private String promoCode;

    @Column(name = "regular_customer_min_completed_bookings")
    private Integer regularCustomerMinCompletedBookings;

    @Column(name = "max_bookings", nullable = false)
    private Integer maxBookings;

    @Column(name = "used_bookings", nullable = false)
    private Integer usedBookings = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.ACTIVE;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getPromotionId() {
        return promotionId;
    }

    public void setPromotionId(Long promotionId) {
        this.promotionId = promotionId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public TargetType getTargetType() {
        return targetType;
    }

    public void setTargetType(TargetType targetType) {
        this.targetType = targetType;
    }

    public DiscountType getDiscountType() {
        return discountType;
    }

    public void setDiscountType(DiscountType discountType) {
        this.discountType = discountType;
    }

    public BigDecimal getDiscountValue() {
        return discountValue;
    }

    public void setDiscountValue(BigDecimal discountValue) {
        this.discountValue = discountValue;
    }

    public String getPromoCode() {
        return promoCode;
    }

    public void setPromoCode(String promoCode) {
        this.promoCode = promoCode;
    }

    public Integer getRegularCustomerMinCompletedBookings() {
        return regularCustomerMinCompletedBookings;
    }

    public void setRegularCustomerMinCompletedBookings(Integer regularCustomerMinCompletedBookings) {
        this.regularCustomerMinCompletedBookings = regularCustomerMinCompletedBookings;
    }

    public Integer getMaxBookings() {
        return maxBookings;
    }

    public void setMaxBookings(Integer maxBookings) {
        this.maxBookings = maxBookings;
    }

    public Integer getUsedBookings() {
        return usedBookings;
    }

    public void setUsedBookings(Integer usedBookings) {
        this.usedBookings = usedBookings;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
