package com.trackngo.booking.api;

import com.trackngo.booking.api.dto.TripDto;

import java.util.List;

public interface TripService {
    TripDto create(TripDto dto);
    TripDto get(Long id);
    List<TripDto> getAll();
    TripDto update(Long id, TripDto dto);
    void delete(Long id);
}
