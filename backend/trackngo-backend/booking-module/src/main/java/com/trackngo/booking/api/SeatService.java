package com.trackngo.booking.api;

import com.trackngo.booking.api.dto.SeatDto;

import java.util.List;

public interface SeatService {
    SeatDto create(SeatDto dto);
    SeatDto get(Long id);
    List<SeatDto> getAll();
    SeatDto update(Long id, SeatDto dto);
    void delete(Long id);
}
