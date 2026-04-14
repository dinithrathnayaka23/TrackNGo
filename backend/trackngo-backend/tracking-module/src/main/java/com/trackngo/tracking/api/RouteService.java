
package com.trackngo.tracking.api;

import com.trackngo.tracking.api.dto.RouteDto;

import java.util.List;

public interface RouteService {
    RouteDto create(RouteDto dto);
    RouteDto get(Long id);
    List<RouteDto> getAll();
    RouteDto update(Long id, RouteDto dto);
    void delete(Long id);
    RouteDto toggleStatus(Long id);
}

