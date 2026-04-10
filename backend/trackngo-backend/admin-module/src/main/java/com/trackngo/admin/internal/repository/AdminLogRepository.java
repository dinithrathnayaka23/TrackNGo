package com.trackngo.admin.internal.repository;

import com.trackngo.admin.internal.entity.AdminLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminLogRepository extends JpaRepository<AdminLog, Long> {
}
