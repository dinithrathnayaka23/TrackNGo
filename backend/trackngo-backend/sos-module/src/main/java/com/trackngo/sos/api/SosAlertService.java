package com.trackngo.sos.api;

import com.trackngo.sos.api.dto.SosAlertDto;
import com.trackngo.sos.api.dto.TriggerSosAlertRequest;

import java.util.List;

public interface SosAlertService {
    /** Creates a new SOS alert for a passenger or driver request. */
    SosAlertDto triggerAlert(TriggerSosAlertRequest request);

    /** Returns all currently triggered SOS alerts for admin monitoring. */
    List<SosAlertDto> getActiveAlerts();

    /** Marks an SOS alert as resolved by an admin. */
    SosAlertDto resolveAlert(Long sosId, Long adminId);

    /** Marks an SOS alert as a false alarm. */
    SosAlertDto dismissAlert(Long sosId, Long adminId);
}
