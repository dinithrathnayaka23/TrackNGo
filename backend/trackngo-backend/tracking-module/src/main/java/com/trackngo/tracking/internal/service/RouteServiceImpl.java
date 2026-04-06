
package com.trackngo.tracking.internal.service;

import com.trackngo.commons.exception.ResourceNotFoundException;
import com.trackngo.tracking.api.RouteService;
import com.trackngo.tracking.api.dto.RouteDto;
import com.trackngo.tracking.internal.entity.Route;
import com.trackngo.tracking.internal.repository.RouteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RouteServiceImpl implements RouteService {
    private final RouteRepository repository;

    @Override
    public RouteDto create(RouteDto dto) {
        Route entity = new Route();
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public RouteDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Route not found")));
    }

    @Override
    public List<RouteDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public RouteDto update(Long id, RouteDto dto) {
        Route entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Route not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private RouteDto toDto(Route entity) {
        RouteDto dto = new RouteDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}

