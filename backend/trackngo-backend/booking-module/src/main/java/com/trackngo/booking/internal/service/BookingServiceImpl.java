package com.trackngo.booking.internal.service;

import com.trackngo.booking.api.BookingService;
import com.trackngo.booking.api.dto.BookingDto;
import com.trackngo.booking.api.dto.RecentBookingDto;
import com.trackngo.booking.events.BookingCreatedEvent;
import com.trackngo.booking.internal.entity.Booking;
import com.trackngo.booking.internal.repository.BookingRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BookingServiceImpl implements BookingService {
    private final BookingRepository repository;
    private final EventPublisher eventPublisher;

    @Override
    public BookingDto create(BookingDto dto) {
        Booking entity = new Booking();
        entity.setName(dto.getName());
        Booking saved = repository.save(entity);
        eventPublisher.publish(new BookingCreatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public BookingDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Booking not found")));
    }

    @Override
    public List<BookingDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public BookingDto update(Long id, BookingDto dto) {
        Booking entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    @Override
    public List<RecentBookingDto> getUpcomingForUser(String email) {
        return repository.findUpcomingRecentByEmail(email)
            .stream()
            .map(item -> {
                RecentBookingDto dto = new RecentBookingDto();
                dto.setBusNumber(item.getBusNumber());
                dto.setBusType(item.getBusType());
                dto.setBookingReference(item.getBookingReference());
                dto.setStartLocation(item.getStartLocation());
                dto.setEndLocation(item.getEndLocation());
                dto.setJourneyDate(item.getJourneyDate());
                dto.setJourneyTime(item.getJourneyTime());
                return dto;
            })
            .toList();
    }

    private BookingDto toDto(Booking entity) {
        BookingDto dto = new BookingDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
