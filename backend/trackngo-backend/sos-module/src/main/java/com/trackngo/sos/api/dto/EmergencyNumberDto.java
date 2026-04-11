package com.trackngo.sos.api.dto;

import lombok.Data;

@Data
public class EmergencyNumberDto {
    private Long emergencyId;
    private String label;
    private String fireBrigade;
    private String ambulance;
    private String police;
    private String helpCenter;
}
