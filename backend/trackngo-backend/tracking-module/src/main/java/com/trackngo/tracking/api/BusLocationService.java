
package com.trackngo.tracking.api;

import com.trackngo.tracking.api.dto.BusLocationDto;

import java.util.List;

public interface BusLocationService {
    BusLocationDto create(BusLocationDto dto);
    BusLocationDto get(Long id);
    List<BusLocationDto> getAll();
    BusLocationDto update(Long id, BusLocationDto dto);
    void delete(Long id);
}

