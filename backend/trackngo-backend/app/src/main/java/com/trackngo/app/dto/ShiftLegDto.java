package com.trackngo.app.dto;

import java.math.BigDecimal;
import java.time.LocalTime;

/**
 * One pickup or drop-off point of a corporate contract's morning or evening
 * shift: a Google Places result (name + exact coordinates) plus the time the
 * bus should be there. Coordinates come from Google Place Details so pricing
 * and routing use the real building/place, not just the nearest town.
 */
public record ShiftLegDto(
        String location,
        BigDecimal latitude,
        BigDecimal longitude,
        LocalTime time
) {
}
