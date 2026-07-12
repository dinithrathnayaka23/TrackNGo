package com.trackngo.aiagent.agents;

import com.trackngo.aiagent.dto.ComplaintAnalysisRequest;
import com.trackngo.aiagent.dto.ComplaintAnalysisResponse;
import com.trackngo.aiagent.services.ComplaintAgentService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Description;

import java.util.function.Function;

@Configuration
@Slf4j
public class ComplaintAgent {

    private final ComplaintAgentService complaintAgentService;

    public ComplaintAgent(ComplaintAgentService complaintAgentService) {
        this.complaintAgentService = complaintAgentService;
    }

    @Bean
    @Description("Summarizes, categorizes, and routes customer complaints to the appropriate support team.")
    public Function<ComplaintAnalysisRequest, ComplaintAnalysisResponse> analyzeComplaint() {
        return request -> {
            log.info("Analyzing complaint from user {} via channel {}", request.userId(), request.channel());
            return complaintAgentService.analyzeComplaint(request);
        };
    }
}
