package com.trackngo.sos.api.dto;

public final class AdminEmergencyNumberDtos {

    private AdminEmergencyNumberDtos() {}

    public record SaveEmergencyNumberRequest(
            String label,
            String fireBrigade,
            String ambulance,
            String police,
            String helpCenter,
            Boolean isActive
    ) {}
}
