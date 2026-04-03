package com.trackngo.driverfleet.api;

import com.trackngo.driverfleet.api.dto.FleetDto;

import java.util.List;

public interface FleetService {
    FleetDto create(FleetDto dto);
    FleetDto get(Long id);
    List<FleetDto> getAll();
    FleetDto update(Long id, FleetDto dto);
    void delete(Long id);
}
