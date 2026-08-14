
package com.trackngo.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(scanBasePackages = "com.trackngo")
@EnableJpaRepositories(basePackages = "com.trackngo")
@EntityScan(basePackages = "com.trackngo")
@EnableScheduling
public class TrackNGoApplication {
    public static void main(String[] args) {
        SpringApplication.run(TrackNGoApplication.class, args);
    }
}
