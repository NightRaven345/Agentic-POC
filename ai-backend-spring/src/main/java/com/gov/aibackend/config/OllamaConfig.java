package com.gov.aibackend.config;

import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.ai.ollama.api.OllamaOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configures OllamaApi and OllamaChatModel for Spring AI 2.0.0
 */
@Configuration
public class OllamaConfig {

    @Value("${spring.ai.ollama.base-url:https://ollama.com}")
    private String rawOllamaBaseUrl;

    @Value("${app.ollama-api-key:}")
    private String ollamaApiKey;

    @Value("${spring.ai.ollama.chat.model:gemma4:31b}")
    private String model;

    private String getCleanBaseUrl() {
        if (rawOllamaBaseUrl == null) return "https://ollama.com";
        String url = rawOllamaBaseUrl.trim().replaceAll("/+$", "");
        if (url.endsWith("/api")) {
            url = url.substring(0, url.length() - 4);
        }
        return url;
    }

    @Bean
    public OllamaApi ollamaApi() {
        String baseUrl = getCleanBaseUrl();
        return new AuthenticatedOllamaApi(baseUrl, ollamaApiKey);
    }

    @Bean
    public OllamaChatModel ollamaChatModel(OllamaApi ollamaApi) {
        OllamaOptions defaultOptions = new OllamaOptions()
                .withModel(model)
                .withTemperature(0.3f)
                .withNumPredict(2500);
        return new OllamaChatModel(ollamaApi, defaultOptions);
    }
}
