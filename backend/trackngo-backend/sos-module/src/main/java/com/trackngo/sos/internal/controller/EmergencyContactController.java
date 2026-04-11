package com.trackngo.sos.internal.controller;

import com.trackngo.commons.ApiResponse;
import com.trackngo.sos.api.EmergencyContactService;
import com.trackngo.sos.api.dto.CreateEmergencyContactRequest;
import com.trackngo.sos.api.dto.EmergencyContactDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/emergency-contacts")
@RequiredArgsConstructor
public class EmergencyContactController {
    private final EmergencyContactService service;

    @GetMapping
    public ApiResponse<List<EmergencyContactDto>> getContacts(
            @RequestParam("ownerId") Long ownerId,
            @RequestParam("ownerType") String ownerType) {
        return ApiResponse.ok("Fetched", service.getContactsByOwner(ownerId, ownerType.toLowerCase()));
    }

    @PostMapping
    public ApiResponse<EmergencyContactDto> addContact(
            @Valid @RequestBody CreateEmergencyContactRequest request) {
        return ApiResponse.ok("Created", service.addContact(request));
    }

    @DeleteMapping("/{contactId}")
    public ApiResponse<Void> deleteContact(@PathVariable("contactId") Long contactId) {
        service.deleteContact(contactId);
        return ApiResponse.ok("Deleted");
    }
}
