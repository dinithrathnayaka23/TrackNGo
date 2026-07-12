package com.trackngo.aiagent.services;

import com.trackngo.aiagent.agents.TripPlanningAgent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@Slf4j
public class TripPlanningAgentService {

    public TripPlanningAgent.RouteResponse findRoutes(TripPlanningAgent.RouteRequest request) {
        log.info("Finding routes for: {} to {} on {}", request.source(), request.destination(), request.date());

        return new TripPlanningAgent.RouteResponse(List.of(
                "Route 1: Express Bus at 10:00 AM",
                "Route 2: Regular Bus at 12:30 PM"
        ));
    }
}
