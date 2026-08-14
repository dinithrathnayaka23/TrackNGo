package com.trackngo.app.controller;

import com.trackngo.app.dto.LocationDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Controller for searching locations (towns/stops) across the bus network.
 * This is used to populate city dropdowns in the mobile application.
 */
@RestController
@RequestMapping("/api/locations")
@RequiredArgsConstructor
public class LocationController {

    private final JdbcTemplate jdbcTemplate;

    /**
     * Searches for locations matching the query string.
     * Searches within the route_stop table for unique town names and their coordinates.
     * 
     * @param query The search string (e.g. "Col" for Colombo)
     * @return A list of matching LocationDto objects
     */
    @GetMapping("/search")
    public List<LocationDto> search(@RequestParam String query) {
        if (query == null || query.trim().length() < 3) {
            return List.of();
        }

        // We use GROUP BY to ensure we don't return the same town multiple times if it appears on multiple routes.
        // We also use MIN(route_id) + priority as a semi-unique ID for frontend list keys.
        String sql = """
            SELECT 
                MIN(route_id * 1000 + priority) as location_id, 
                name, 
                latitude, 
                longitude 
            FROM route_stop 
            WHERE LOWER(name) LIKE ? 
            GROUP BY name, latitude, longitude 
            LIMIT 10
            """;
        
        String searchTerm = "%" + query.trim().toLowerCase() + "%";
        
        return jdbcTemplate.query(sql, (rs, rowNum) -> new LocationDto(
                rs.getLong("location_id"),
                rs.getString("name"),
                rs.getBigDecimal("latitude"),
                rs.getBigDecimal("longitude")
        ), searchTerm);
    }
}
