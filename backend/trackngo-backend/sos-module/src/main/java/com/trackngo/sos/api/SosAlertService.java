package com.trackngo.sos.api;

import com.trackngo.sos.api.dto.SosAlertDto;
import com.trackngo.sos.api.dto.TriggerSosAlertRequest;

import java.time.LocalDate;
import java.util.List;

public interface SosAlertService {
    /** Creates a new SOS alert for a passenger or driver request. */
    SosAlertDto triggerAlert(TriggerSosAlertRequest request);

    /** Returns all currently triggered SOS alerts for admin monitoring. */
    List<SosAlertDto> getActiveAlerts();

    /**
     * Returns past alerts of every status for the admin history report.
     *
     * Each filter is optional: a null {@code from} or {@code to} leaves that end of the
     * range open, and a null {@code status} or {@code triggeredBy} matches all of them.
     * Both dates are inclusive.
     */
    List<SosAlertDto> getAlertHistory(LocalDate from, LocalDate to, String status, String triggeredBy);

    /** Marks an SOS alert as resolved by an admin. */
    SosAlertDto resolveAlert(Long sosId, Long adminId);

    /** Marks an SOS alert as a false alarm. */
    SosAlertDto dismissAlert(Long sosId, Long adminId);
}
