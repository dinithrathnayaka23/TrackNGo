package com.trackngo.sos.internal.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "sos_alert")
public class SosAlert {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "sos_id")
    private Long sosId;

    @Column(name = "shared_location")
    private String sharedLocation;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private SosStatus status;

    @Column(name = "triggered_at", updatable = false)
    private LocalDateTime triggeredAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "passenger_id")
    private Long passengerId;

    @Column(name = "driver_id")
    private Long driverId;

    @Column(name = "bus_id")
    private Long busId;

    @Column(name = "bus_number")
    private String busNumber;

    @Column(name = "start_location")
    private String startLocation;

    @Column(name = "end_location")
    private String endLocation;

    @Column(name = "admin_id")
    private Long adminId;

    @PrePersist
    protected void onCreate() {
        if (triggeredAt == null) triggeredAt = LocalDateTime.now();
        if (status == null) status = SosStatus.triggered;
    }

    public enum SosStatus {
        triggered, resolved, false_alarm
    }
}
