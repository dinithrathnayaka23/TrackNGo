package com.trackngo.sos.api.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class SosAlertDto {
    private Long sosId;
    private String sharedLocation;
    private String status;
    private LocalDateTime triggeredAt;
    private LocalDateTime resolvedAt;

    // Passenger/Driver info (joined)
    private Long passengerId;
    private Long driverId;
    private String triggeredByType; // "passenger" or "driver"
    private String name;
    private String phoneNumber;
    private String profilePhoto;

    // Route & bus info (optional)
    private String routeName;
    private String busNumber;
    private String startLocation;
    private String endLocation;

    // Explicit person details for admin popup
    private String passengerName;
    private String passengerPhoneNumber;
    private String driverName;
    private String driverPhoneNumber;

    // Emergency contacts of the person who triggered the SOS
    private List<EmergencyContactDto> emergencyContacts;
}
