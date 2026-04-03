package com.trackngo.driverfleet.api;

import com.trackngo.driverfleet.api.dto.BusDto;

import java.util.List;

public interface BusService {
    BusDto create(BusDto dto);
    BusDto get(Long id);
    List<BusDto> getAll();
    BusDto update(Long id, BusDto dto);
    void delete(Long id);
}
