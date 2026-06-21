
package com.trackngo.tracking.internal.service;

import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import com.trackngo.tracking.api.BusLocationService;
import com.trackngo.tracking.api.dto.BusLocationDto;
import com.trackngo.tracking.events.TrackingUpdatedEvent;
import com.trackngo.tracking.internal.entity.BusLocation;
import com.trackngo.tracking.internal.repository.BusLocationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/*
  Service implementation for managing bus locations.
  Handles business logic for CRUD operations and triggers tracking events.
*/
@Service
@RequiredArgsConstructor
public class BusLocationServiceImpl implements BusLocationService {
    private final BusLocationRepository repository;
    private final EventPublisher eventPublisher;

    /*
      Creates a new bus location and publishes a tracking update event.
      @param dto The location data to create.
      @return The created BusLocationDto.
    */
    @Override
    public BusLocationDto create(BusLocationDto dto) {
        BusLocation entity = new BusLocation();
        entity.setName(dto.getName());
        BusLocation saved = repository.save(entity);
        eventPublisher.publish(new TrackingUpdatedEvent(saved.getId()));
        return toDto(saved);
    }

    /*
      Retrieves a bus location by its unique ID.
      @param id The ID of the location to fetch.
      @return The found BusLocationDto.
      @throws ResourceNotFoundException if the location does not exist.
    */
    @Override
    public BusLocationDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("BusLocation not found")));
    }

    /*
      Fetches all bus locations from the repository.
      @return A list of all BusLocationDto records.
    */
    @Override
    public List<BusLocationDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    /*
      Updates an existing bus location and publishes a tracking update event.
      @param id  The ID of the location to update.
      @param dto The updated data.
      @return The updated BusLocationDto.
      @throws ResourceNotFoundException if the location does not exist.
    */
    @Override
    public BusLocationDto update(Long id, BusLocationDto dto) {
        BusLocation entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("BusLocation not found"));
        entity.setName(dto.getName());
        BusLocation saved = repository.save(entity);
        eventPublisher.publish(new TrackingUpdatedEvent(saved.getId()));
        return toDto(saved);
    }

    /*
      Deletes a bus location record by its ID.
      @param id The ID of the record to delete.
    */
    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    /*
      Helper method to convert a BusLocation entity to a DTO.
      @param entity The entity to convert.
      @return The converted DTO.
    */
    private BusLocationDto toDto(BusLocation entity) {
        BusLocationDto dto = new BusLocationDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}

