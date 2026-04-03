package com.trackngo.driverfleet.api;

import com.trackngo.driverfleet.api.dto.DriverDto;

import java.util.List;

public interface DriverService {
    DriverDto create(DriverDto dto);
    DriverDto get(Long id);
    List<DriverDto> getAll();
    DriverDto update(Long id, DriverDto dto);
    void delete(Long id);
}
