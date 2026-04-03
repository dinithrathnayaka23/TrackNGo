package com.trackngo.complaint.api;

import com.trackngo.complaint.api.dto.ComplaintDto;

import java.util.List;

public interface ComplaintService {
    ComplaintDto create(ComplaintDto dto);
    ComplaintDto get(Long id);
    List<ComplaintDto> getAll();
    ComplaintDto update(Long id, ComplaintDto dto);
    void delete(Long id);
}
