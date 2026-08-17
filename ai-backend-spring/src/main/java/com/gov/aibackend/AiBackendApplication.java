package com.gov.aibackend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Government Portal AI Microservice — Spring AI Edition.
 * Drop-in replacement for the Python FastAPI ai-backend service.
 * Runs on port 8000.
 */
@SpringBootApplication
public class AiBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(AiBackendApplication.class, args);
    }
}
