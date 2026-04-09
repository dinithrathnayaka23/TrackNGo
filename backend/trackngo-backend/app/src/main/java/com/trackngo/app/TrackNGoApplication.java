
package com.trackngo.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = "com.trackngo")
@EnableJpaRepositories(basePackages = "com.trackngo")
public class TrackNGoApplication {
    public static void main(String[] args) {
        SpringApplication.run(TrackNGoApplication.class, args);
    }
}