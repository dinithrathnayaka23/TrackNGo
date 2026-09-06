package com.trackngo.tracking.internal.service;

import com.trackngo.tracking.api.dto.LiveBusLocationDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * Writes each accepted GPS fix into {@code bus_locations}.
 *
 * Live tracking keeps the newest fix per bus in memory and pushes it to
 * passengers over the WebSocket, which is all the map needs. Nothing outside
 * that process could see it, so the AI assistant - which reads the table - was
 * answering "where is this bus" from whatever happened to be in the table,
 * which on a fresh install is seed data weeks old. Recording the fix here is
 * what connects the two.
 *
 * One row is kept per bus rather than a full trail: the only reader wants the
 * latest position, and an append per ping would grow without bound.
 *
 * A failure to record must never cost the passenger their live map, so every
 * problem is swallowed after logging and the caller carries on broadcasting.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BusLocationRecorder {

    private final JdbcTemplate jdbc;

    public void record(LiveBusLocationDto fix) {
        if (fix == null || fix.getBusNumber() == null || fix.getBusNumber().isBlank()) {
            return;
        }
        if (fix.getLatitude() == null || fix.getLongitude() == null) {
            return;
        }

        // The moment the server accepted the fix, not the device's own clock,
        // which may be wrong and would then make the row look stale or future-dated.
        LocalDateTime recordedAt = fix.getServerTimestamp() == null
                ? LocalDateTime.now()
                : LocalDateTime.ofInstant(
                        Instant.ofEpochMilli(fix.getServerTimestamp()), ZoneId.systemDefault());

        try {
            int updated = jdbc.update("""
                    UPDATE bus_locations
                    SET latitude = ?, longitude = ?, heading = ?, speed = ?, recorded_at = ?
                    WHERE bus_number = ?
                    """,
                    fix.getLatitude(),
                    fix.getLongitude(),
                    fix.getHeading(),
                    fix.getSpeed(),
                    Timestamp.valueOf(recordedAt),
                    fix.getBusNumber());

            if (updated == 0) {
                jdbc.update("""
                        INSERT INTO bus_locations
                            (name, bus_number, latitude, longitude, heading, speed, recorded_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        fix.getBusNumber(),
                        fix.getBusNumber(),
                        fix.getLatitude(),
                        fix.getLongitude(),
                        fix.getHeading(),
                        fix.getSpeed(),
                        Timestamp.valueOf(recordedAt));
            }
        } catch (Exception ex) {
            log.warn("Could not record location for {}: {}", fix.getBusNumber(), ex.getMessage());
        }
    }
}
