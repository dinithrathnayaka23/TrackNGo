
package com.trackngo.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.trackngo")
public class TrackNGoApplication {
    public static void main(String[] args) {
        SpringApplication.run(TrackNGoApplication.class, args);
    }
}

