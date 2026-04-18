package com.trackngo.booking.internal.controller;

import com.trackngo.booking.api.dto.AdminBusDtos.*;
import com.trackngo.booking.internal.service.AdminBusService;
import com.trackngo.commons.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/buses")
public class AdminBusController {

    private final AdminBusService service;

    public AdminBusController(AdminBusService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<BusListItem>> listBuses() {
        return ApiResponse.ok("Buses", service.listBuses());
    }

    @GetMapping("/{busId}")
    public ApiResponse<BusDetail> getBusDetail(@PathVariable Long busId) {
        return ApiResponse.ok("Bus detail", service.getBusDetail(busId));
    }

    @PostMapping
    public ApiResponse<Long> createBus(@RequestBody SaveBusRequest request) {
        Long id = service.createBus(request);
        return ApiResponse.ok("Bus created", id);
    }

    @PutMapping("/{busId}")
    public ApiResponse<Void> updateBus(@PathVariable Long busId, @RequestBody SaveBusRequest request) {
        service.updateBus(busId, request);
        return ApiResponse.ok("Bus updated", null);
    }

    @DeleteMapping("/{busId}")
    public ApiResponse<Void> deleteBus(@PathVariable Long busId) {
        service.deleteBus(busId);
        return ApiResponse.ok("Bus deleted", null);
    }

    @GetMapping("/{busId}/seat-layout")
    public ApiResponse<List<SeatLayoutRow>> getSeatLayout(@PathVariable Long busId) {
        return ApiResponse.ok("Seat layout", service.getSeatLayout(busId));
    }

    @PutMapping("/{busId}/seat-layout")
    public ApiResponse<Void> saveSeatLayout(@PathVariable Long busId, @RequestBody SaveSeatLayoutRequest request) {
        service.saveSeatLayout(busId, request);
        return ApiResponse.ok("Seat layout saved", null);
    }

    @GetMapping("/options/drivers")
    public ApiResponse<List<DriverOption>> getDriverOptions() {
        return ApiResponse.ok("Drivers", service.getDriverOptions());
    }

    @GetMapping("/options/routes")
    public ApiResponse<List<RouteOption>> getRouteOptions() {
        return ApiResponse.ok("Routes", service.getRouteOptions());
    }
}
