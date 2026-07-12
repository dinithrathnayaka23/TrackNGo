package com.trackngo.aiagent.services;

import com.trackngo.aiagent.dto.ComplaintAnalysisRequest;
import com.trackngo.aiagent.dto.ComplaintAnalysisResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
@Slf4j
public class ComplaintAgentService {

    public ComplaintAnalysisResponse analyzeComplaint(ComplaintAnalysisRequest request) {
        String complaintText = request.complaintText().toLowerCase(Locale.ROOT);
        String category = detectCategory(complaintText);
        String priority = detectPriority(complaintText, category);
        String routingTarget = determineRoutingTarget(category, priority);
        String suggestedAction = recommendAction(category, priority);
        String summary = buildSummary(complaintText, category);

        log.info("Analyzed complaint for user {}: category={}, priority={}, routingTarget={}",
                request.userId(), category, priority, routingTarget);

        return new ComplaintAnalysisResponse(summary, category, priority, routingTarget, suggestedAction);
    }

    private String buildSummary(String complaintText, String category) {
        String normalized = complaintText.length() > 120 ? complaintText.substring(0, 117).trim() + "..." : complaintText;
        return "Complaint classified as " + category.toLowerCase(Locale.ROOT) + ": " + normalized;
    }

    private String detectCategory(String complaintText) {
        if (complaintText.contains("safety") || complaintText.contains("accident") || complaintText.contains("medical")) {
            return "SAFETY_INCIDENT";
        }
        if (complaintText.contains("delay") || complaintText.contains("late") || complaintText.contains("traffic")) {
            return "SERVICE_DELAY";
        }
        if (complaintText.contains("refund") || complaintText.contains("payment") || complaintText.contains("charge")) {
            return "PAYMENT_ISSUE";
        }
        if (complaintText.contains("driver") || complaintText.contains("rude") || complaintText.contains("behavior")) {
            return "DRIVER_BEHAVIOR";
        }
        if (complaintText.contains("bus") || complaintText.contains("route") || complaintText.contains("service")) {
            return "SERVICE_QUALITY";
        }
        return "GENERAL_COMPLAINT";
    }

    private String detectPriority(String complaintText, String category) {
        if (category.equals("SAFETY_INCIDENT") || complaintText.contains("emergency") || complaintText.contains("danger")) {
            return "URGENT";
        }
        if (complaintText.contains("refund") || complaintText.contains("lost") || complaintText.contains("harassment")) {
            return "HIGH";
        }
        return "MEDIUM";
    }

    private String determineRoutingTarget(String category, String priority) {
        if ("URGENT".equals(priority)) {
            return "OPS_ESCALATION";
        }
        if ("PAYMENT_ISSUE".equals(category)) {
            return "FINANCE_SUPPORT";
        }
        if ("DRIVER_BEHAVIOR".equals(category)) {
            return "CUSTOMER_SAFETY_TEAM";
        }
        return "CUSTOMER_SUPPORT";
    }

    private String recommendAction(String category, String priority) {
        if ("URGENT".equals(priority)) {
            return "Escalate immediately and notify the operations team for rapid follow-up.";
        }
        if ("PAYMENT_ISSUE".equals(category)) {
            return "Review the payment record and prepare a refund or correction response.";
        }
        return "Acknowledge the complaint, document case details, and assign follow-up.";
    }
}
