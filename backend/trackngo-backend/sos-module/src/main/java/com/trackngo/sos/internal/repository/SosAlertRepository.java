package com.trackngo.sos.internal.repository;

import com.trackngo.sos.internal.entity.SosAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface SosAlertRepository extends JpaRepository<SosAlert, Long> {

    List<SosAlert> findByStatusInOrderByTriggeredAtDesc(List<SosAlert.SosStatus> statuses);

    @Query("SELECT s FROM SosAlert s WHERE s.status = 'triggered' ORDER BY s.triggeredAt DESC")
    List<SosAlert> findActiveAlerts();
}
