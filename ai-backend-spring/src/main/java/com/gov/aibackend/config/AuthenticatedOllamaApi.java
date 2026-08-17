package com.gov.aibackend.config;

import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.util.Assert;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * Custom extension of OllamaApi that ensures the Authorization header (Bearer token)
 * is passed on every WebClient HTTP request for chat and streamingChat endpoints.
 */
public class AuthenticatedOllamaApi extends OllamaApi {

    private final WebClient authenticatedWebClient;

    public AuthenticatedOllamaApi(String baseUrl, String bearerToken) {
        super(baseUrl);
        WebClient.Builder builder = WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);

        if (bearerToken != null && !bearerToken.isBlank()) {
            builder.defaultHeader(HttpHeaders.AUTHORIZATION, bearerToken);
        }

        this.authenticatedWebClient = builder.build();
    }

    @Override
    public ChatResponse chat(ChatRequest request) {
        Assert.notNull(request, "The request body can not be null.");
        Assert.isTrue(request.stream() == null || !request.stream(), "Request must set the stream property to false.");

        return this.authenticatedWebClient.post()
                .uri("/api/chat")
                .body(Mono.just(request), ChatRequest.class)
                .retrieve()
                .bodyToMono(ChatResponse.class)
                .block();
    }

    @Override
    public Flux<ChatResponse> streamingChat(ChatRequest request) {
        Assert.notNull(request, "The request body can not be null.");
        Assert.isTrue(Boolean.TRUE.equals(request.stream()), "Request must set the stream property to true.");

        return this.authenticatedWebClient.post()
                .uri("/api/chat")
                .body(Mono.just(request), ChatRequest.class)
                .retrieve()
                .bodyToFlux(ChatResponse.class);
    }
}
