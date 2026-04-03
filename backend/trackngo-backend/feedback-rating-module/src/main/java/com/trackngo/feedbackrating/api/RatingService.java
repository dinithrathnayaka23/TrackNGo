package com.trackngo.feedbackrating.api;

import com.trackngo.feedbackrating.api.dto.RatingDto;

import java.util.List;

public interface RatingService {
    RatingDto create(RatingDto dto);
    RatingDto get(Long id);
    List<RatingDto> getAll();
    RatingDto update(Long id, RatingDto dto);
    void delete(Long id);
}
