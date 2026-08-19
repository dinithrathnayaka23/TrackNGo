package com.trackngo.booking.internal.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Step 1: The Entity (The Database Blueprint)
 * 
 * In a Spring Boot application, an "@Entity" tells Java: 
 * "Please create a database table based on this class!"
 */
@Entity // This tells Spring Boot this is a database table
@Data // This automatically creates getters and setters for us (from Lombok)
@Table(name = "trip_booking") // This will name the table "trip_booking" in MySQL
public class TripBooking {

    // 1. Every database table needs a Primary Key (a unique ID).
    @Id // Marks this as the primary key
    @GeneratedValue(strategy = GenerationType.IDENTITY) // Tells MySQL to auto-increment (1, 2, 3...)
    @Column(name = "trip_booking_id")
    private Long id;

    // 2. These are the columns for the trip details
    @Column(name = "start_location", nullable = false)
    private String startLocation;

    @Column(name = "destination", nullable = false)
    private String destination;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "return_date")
    private LocalDate returnDate; // Optional, so no "nullable = false"

    // 3. Columns for passengers and pricing
    @Column(name = "passenger_count", nullable = false)
    private Integer passengerCount = 1; // Default is 1

    @Column(name = "advance_payment")
    private BigDecimal advancePayment; // BigDecimal is best for money/currency!

    @Column(name = "final_price")
    private BigDecimal finalPrice;

    /** Server estimate shown while the request is waiting for negotiation. */
    @Column(name = "estimated_price")
    private BigDecimal estimatedPrice;

    /** Discount entered by an administrator during the negotiation. */
    @Column(name = "discount_amount")
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "admin_note")
    private String adminNote;

    @Column(name = "negotiated_at")
    private LocalDateTime negotiatedAt;

    // 4. Status of the booking (e.g., pending, confirmed)
    @Column(name = "booking_status")
    private String bookingStatus;

    // 5. This stores exactly when the record was created
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    // 6. Relationships (Who made the booking?)
    // For now, we just store the User's ID to keep it simple.
    @Column(name = "passenger_id", nullable = false)
    private Long passengerId;

    @Column(name = "driver_id")
    private Long driverId;

    @Column(name = "bus_id")
    private Long busId;

    @Transient
    private String busNumber;

    @Transient
    private String busBrand;

    @Transient
    private String paymentStatus;

    @Transient
    private String transactionId;

    /**
     * This special method automatically runs just before the data is saved
     * to the database for the very first time. It sets the exact time.
     */
    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
