package com.trackngo.sos.internal.service;

public interface SmsProvider {

    void sendSms(String toNumber, String message);

    boolean isConfigured();

    String getProviderName();
}
