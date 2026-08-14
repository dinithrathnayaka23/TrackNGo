package com.trackngo.aiagent.agents;

import com.trackngo.aiagent.dto.RecommendationRequest;
import com.trackngo.aiagent.dto.RecommendationResponse;
import com.trackngo.aiagent.services.RecommendationAgentService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Description;

import java.util.function.Function;

@Configuration
@Slf4j
public class RecommendationAgent {

    private final RecommendationAgentService recommendationAgentService;

    public RecommendationAgent(RecommendationAgentService recommendationAgentService) {
        this.recommendationAgentService = recommendationAgentService;
    }

    @Bean
    @Description("Learns from user preferences and suggests personalized travel recommendations.")
    public Function<RecommendationRequest, RecommendationResponse> generateRecommendations() {
        return request -> {
            log.info("Generating recommendations for user {} based on travel context {}", request.userId(), request.travelContext());
            return recommendationAgentService.generateRecommendations(request);
        };
    }
}
