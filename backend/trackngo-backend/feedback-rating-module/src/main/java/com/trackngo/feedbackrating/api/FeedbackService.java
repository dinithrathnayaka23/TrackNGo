package com.trackngo.feedbackrating.api;

import com.trackngo.feedbackrating.api.dto.FeedbackDto;

import java.util.List;

public interface FeedbackService {
    FeedbackDto create(FeedbackDto dto);
    FeedbackDto get(Long id);
    List<FeedbackDto> getAll();
    FeedbackDto update(Long id, FeedbackDto dto);
    void delete(Long id);
}
