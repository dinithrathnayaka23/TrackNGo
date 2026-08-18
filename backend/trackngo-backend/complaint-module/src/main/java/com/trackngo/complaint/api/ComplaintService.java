package com.trackngo.complaint.api;

import com.trackngo.complaint.api.dto.ComplaintDto;

import java.util.List;

public interface ComplaintService {
    /** Creates a complaint for the given user email. */
    ComplaintDto create(String email, ComplaintDto dto);

    /** Returns a single complaint by its identifier. */
    ComplaintDto get(Long id);

    /** Returns all complaints in the system. */
    List<ComplaintDto> getAll();

    /** Returns the complaints submitted by the given user email. */
    List<ComplaintDto> getMine(String email);

    /** Returns the complaints filed against the given driver. */
    List<ComplaintDto> getForDriver(Long driverId);

    /** Updates an existing complaint using the provided payload. */
    ComplaintDto update(Long id, ComplaintDto dto);

    /** Deletes a complaint by its identifier. */
    void delete(Long id);
}
