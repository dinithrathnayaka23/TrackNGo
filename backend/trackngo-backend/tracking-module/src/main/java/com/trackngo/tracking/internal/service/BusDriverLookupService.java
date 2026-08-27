package com.trackngo.tracking.internal.service;

import com.trackngo.tracking.api.dto.BusDriverDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Resolves which driver is assigned to a bus.
 *
 * <p>Buses have no JPA entity in this project, so this reads the shared `bus`
 * table directly, the same way the booking and driver modules do.
 */
@Service
@RequiredArgsConstructor
public class BusDriverLookupService {

    private static final String DRIVER_FOR_BUS_SQL = """
            SELECT
                b.driver_id AS driver_id,
                TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS driver_name,
                d.profile_photo AS profile_photo
            FROM bus b
            JOIN `user` u ON u.user_id = b.driver_id
            LEFT JOIN driver d ON d.driver_id = b.driver_id
            WHERE b.bus_number = ?
            """;

    private final JdbcTemplate jdbcTemplate;

    /**
     * Returns the driver assigned to the given bus number, or empty when the bus
     * is unknown or currently has no driver assigned.
     */
    @Transactional(readOnly = true)
    public Optional<BusDriverDto> findDriverForBus(String busNumber) {
        if (busNumber == null || busNumber.isBlank()) {
            return Optional.empty();
        }

        return jdbcTemplate.query(DRIVER_FOR_BUS_SQL, rs -> {
            if (!rs.next()) {
                return Optional.empty();
            }

            String name = rs.getString("driver_name");
            return Optional.of(new BusDriverDto(
                    rs.getLong("driver_id"),
                    name == null || name.isBlank() ? null : name.trim(),
                    rs.getString("profile_photo")));
        }, busNumber.trim());
    }
}
