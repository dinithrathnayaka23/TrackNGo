
package com.trackngo.tracking.internal.controller;

import com.trackngo.commons.ApiResponse;
import com.trackngo.tracking.api.RouteService;
import com.trackngo.tracking.api.dto.RouteDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/*
  REST Controller for managing bus routes.
  Provides endpoints for route creation, retrieval, updates, status toggling, and deletion.
*/
@RestController
@RequestMapping("/api/routes")
@RequiredArgsConstructor
public class RouteController {
    private final RouteService service;

    /*
      Creates a new bus route record.
      @param dto The route data transfer object containing route details and stops.
      @return ApiResponse containing the created RouteDto.
    */
    @PostMapping
    public ApiResponse<RouteDto> create(@Valid @RequestBody RouteDto dto) {
        return ApiResponse.ok("Route created", service.create(dto));
    }

    /*
      Retrieves a specific route by its ID.
      @param id The unique ID of the route.
      @return ApiResponse containing the requested RouteDto.
    */
    @GetMapping("/{id}")
    public ApiResponse<RouteDto> get(@PathVariable("id") Long id) {
        return ApiResponse.ok("Fetched", service.get(id));
    }

    /*
      Retrieves all available bus routes.
      @return ApiResponse containing a list of all RouteDto records.
    */
    @GetMapping
    public ApiResponse<List<RouteDto>> getAll() {
        return ApiResponse.ok("Fetched", service.getAll());
    }

    /*
      Updates an existing route's information.
      @param id  The ID of the route to update.
      @param dto The updated route data.
      @return ApiResponse containing the updated RouteDto.
    */
    @PutMapping("/{id}")
    public ApiResponse<RouteDto> update(@PathVariable("id") Long id, @Valid @RequestBody RouteDto dto) {
        return ApiResponse.ok("Route updated", service.update(id, dto));
    }

    /*
      Deletes a route record by its ID.
      @param id The ID of the route to delete.
      @return ApiResponse indicating successful deletion.
    */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable("id") Long id) {
        service.delete(id);
        return ApiResponse.ok("Route deleted", null);
    }

    /*
      Toggles the active status of a route.
      @param id The ID of the route to toggle.
      @return ApiResponse containing the RouteDto with the updated status.
    */
    @PatchMapping("/{id}/toggle-status")
    public ApiResponse<RouteDto> toggleStatus(@PathVariable("id") Long id) {
        return ApiResponse.ok("Status toggled", service.toggleStatus(id));
    }
}

