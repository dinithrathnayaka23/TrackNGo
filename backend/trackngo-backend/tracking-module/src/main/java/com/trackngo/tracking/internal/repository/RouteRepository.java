
package com.trackngo.tracking.internal.repository;

import com.trackngo.tracking.internal.entity.Route;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface RouteRepository extends JpaRepository<Route, Long> {
    boolean existsByRouteCode(String routeCode);
    boolean existsByRouteCodeAndIdNot(String routeCode, Long id);

    @Query("SELECT DISTINCT r FROM Route r LEFT JOIN FETCH r.stops WHERE r.id = :routeId")
    Optional<Route> findByIdWithStops(@Param("routeId") Long routeId);
}

