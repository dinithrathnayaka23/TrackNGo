package com.trackngo.sos.api.dto;

import lombok.Data;

@Data
public class TriggerSosAlertRequest {
    private Long passengerId;
    private Long driverId;
    private String sharedLocation;
    private String busNumber;
    private String startLocation;
    private String endLocation;
    private Boolean notifyEmergencyContacts;
}
