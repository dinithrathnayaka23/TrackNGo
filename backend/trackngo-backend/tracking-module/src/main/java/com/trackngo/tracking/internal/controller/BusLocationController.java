
package com.trackngo.tracking.internal.controller;

import com.trackngo.commons.ApiResponse;
import com.trackngo.tracking.api.BusLocationService;
import com.trackngo.tracking.api.dto.BusLocationDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/*
  REST Controller for managing bus location data.
  Provides endpoints for creating, retrieving, updating, and deleting real-time or historical bus locations.
 */
@RestController
@RequestMapping("/api/bus-locations")
@RequiredArgsConstructor
public class BusLocationController {
    private final BusLocationService service;

    /*
      Creates a new bus location record.
      @param dto The bus location data transfer object containing location details.
      @return ApiResponse containing the created BusLocationDto.
     */
    @PostMapping
    public ApiResponse<BusLocationDto> create(@Valid @RequestBody BusLocationDto dto) {
        return ApiResponse.ok("Created", service.create(dto));
    }

    /*
      Retrieves a specific bus location by its unique identifier.
      @param id The unique ID of the bus location record.
      @return ApiResponse containing the requested BusLocationDto.
     */
    @GetMapping("/{id}")
    public ApiResponse<BusLocationDto> get(@PathVariable Long id) {
        return ApiResponse.ok("Fetched", service.get(id));
    }

    /*
      Retrieves all recorded bus locations.
      @return ApiResponse containing a list of all BusLocationDto records.
     */
    @GetMapping
    public ApiResponse<List<BusLocationDto>> getAll() {
        return ApiResponse.ok("Fetched", service.getAll());
    }

    /*
      Updates an existing bus location record.
      @param id  The ID of the location record to update.
      @param dto The updated bus location data.
      @return ApiResponse containing the updated BusLocationDto.
     */
    @PutMapping("/{id}")
    public ApiResponse<BusLocationDto> update(@PathVariable Long id, @Valid @RequestBody BusLocationDto dto) {
        return ApiResponse.ok("Updated", service.update(id, dto));
    }

    /*
      Deletes a bus location record by its ID.
      @param id The ID of the record to delete.
      @return ApiResponse indicating successful deletion.
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok("Deleted", null);
    }
}

