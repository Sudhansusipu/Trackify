package com.smartlife.manager;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SmartLifeManagerApplication {
    public static void main(String[] args) {
        SpringApplication.run(SmartLifeManagerApplication.class, args);
    }
}

