package com.trackngo.sos.internal.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

@Configuration
public class SmsProviderConfig {

    private static final Logger log = LoggerFactory.getLogger(SmsProviderConfig.class);

    @Bean
    @Primary
    public SmsProvider smsProvider(
            @Value("${sms.provider:twilio}") String providerName,
            TwilioSmsService twilioSmsService,
            AndroidSmsGatewayService androidSmsGatewayService) {

        if ("android-gateway".equalsIgnoreCase(providerName)) {
            log.info("SMS provider configured: Android SMS Gateway");
            return androidSmsGatewayService;
        }

        log.info("SMS provider configured: Twilio");
        return twilioSmsService;
    }
}
