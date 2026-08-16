package com.trackngo.booking.api;

import com.trackngo.booking.api.dto.BookingDto;
import com.trackngo.booking.api.dto.BookingHistoryDto;
import com.trackngo.booking.api.dto.RecentBookingDto;
import com.trackngo.booking.api.dto.AdminBookingDto;

import java.util.List;

public interface BookingService {
    BookingDto create(BookingDto dto);
    BookingDto get(Long id);
    List<BookingDto> getAll();
    List<AdminBookingDto> getAllForAdmin();
    List<AdminBookingDto> getTripBookingRequestsForAdmin();
    BookingDto update(Long id, BookingDto dto);
    void delete(Long id);

    List<RecentBookingDto> getUpcomingForUser(String email);
    List<BookingHistoryDto> getUpcomingBookings(String email);
    List<BookingHistoryDto> getPastBookings(String email);
}
