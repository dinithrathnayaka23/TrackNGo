package com.trackngo.aiagent.agents;

import com.trackngo.aiagent.services.TripPlanningAgentService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TripPlanningAgentTest {

    @Test
    void shouldReturnRouteOptions() {
        TripPlanningAgent tripPlanningAgent = new TripPlanningAgent(new TripPlanningAgentService());
        TripPlanningAgent.RouteRequest request = new TripPlanningAgent.RouteRequest("Colombo", "Kandy", "2026-07-15");

        var function = tripPlanningAgent.findRoutes();
        TripPlanningAgent.RouteResponse response = function.apply(request);

        assertNotNull(response);
        assertFalse(response.routes().isEmpty());
        assertTrue(response.routes().stream().anyMatch(route -> route.contains("Express")));
    }
}
