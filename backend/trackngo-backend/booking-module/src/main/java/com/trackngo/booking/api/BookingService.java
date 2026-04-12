package com.trackngo.booking.api;

import com.trackngo.booking.api.dto.BookingDto;
import com.trackngo.booking.api.dto.RecentBookingDto;

import java.util.List;

public interface BookingService {
    BookingDto create(BookingDto dto);
    BookingDto get(Long id);
    List<BookingDto> getAll();
    BookingDto update(Long id, BookingDto dto);
    void delete(Long id);

    List<RecentBookingDto> getUpcomingForUser(String email);
}
