package com.trackngo.complaint.internal.controller;

import com.trackngo.complaint.api.dto.AdminComplaintDtos.AdminComplaintDetail;
import com.trackngo.complaint.api.dto.AdminComplaintDtos.AdminComplaintListItem;
import com.trackngo.complaint.api.dto.AdminComplaintDtos.AdminComplaintUpdateRequest;
import com.trackngo.complaint.internal.service.AdminComplaintService;
import com.trackngo.commons.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/complaints")
public class AdminComplaintController {
    private final AdminComplaintService service;

    public AdminComplaintController(AdminComplaintService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<AdminComplaintListItem>> listComplaints() {
        return ApiResponse.ok("Complaints", service.listComplaints());
    }

    @GetMapping("/{complaintId}")
    public ApiResponse<AdminComplaintDetail> getComplaintDetail(@PathVariable Long complaintId) {
        return ApiResponse.ok("Complaint detail", service.getComplaintDetail(complaintId));
    }

    @PutMapping("/{complaintId}")
    public ApiResponse<Void> updateComplaint(
            @PathVariable Long complaintId,
            @RequestBody AdminComplaintUpdateRequest request) {
        service.updateComplaint(complaintId, request);
        return ApiResponse.ok("Complaint updated", null);
    }
}
