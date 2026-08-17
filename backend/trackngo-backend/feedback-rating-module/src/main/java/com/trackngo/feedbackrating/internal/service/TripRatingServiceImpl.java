package com.trackngo.feedbackrating.internal.service;

import com.trackngo.feedbackrating.api.TripRatingService;
import com.trackngo.feedbackrating.api.dto.TripRatingDto;
import com.trackngo.feedbackrating.internal.repository.DriverTripRatingView;
import com.trackngo.feedbackrating.internal.repository.TripRatingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TripRatingServiceImpl implements TripRatingService {
    private final TripRatingRepository repository;

    @Override
    public List<TripRatingDto> getRatingsForDriver(Long driverId) {
        return repository.findRatingsForDriver(driverId)
            .stream()
            .map(this::toDto)
            .toList();
    }

    private TripRatingDto toDto(DriverTripRatingView row) {
        TripRatingDto dto = new TripRatingDto();
        dto.setId(row.getRatingId());
        dto.setDriverRating(row.getDriverRating());
        dto.setBusConditionRating(row.getBusConditionRating());
        dto.setJourneyRating(row.getJourneyRating());
        dto.setReviewText(row.getReviewText());
        dto.setImage(row.getImage());
        dto.setCreatedAt(row.getCreatedAt());
        dto.setBusNumber(row.getBusNumber());
        dto.setPassengerName(buildPassengerName(row.getPassengerFirstName(), row.getPassengerLastName()));
        return dto;
    }

    private String buildPassengerName(String firstName, String lastName) {
        String first = firstName == null ? "" : firstName.trim();
        String last = lastName == null ? "" : lastName.trim();
        String fullName = (first + " " + last).trim().replaceAll("\\s+", " ");
        return fullName.isBlank() ? "Passenger" : fullName;
    }
}
