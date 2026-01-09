package com.dogbank.chatbot.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatResponse {
    private String message;
    private String action;  // "none", "check_balance", "pix_transfer", "statement", "help"
    private Map<String, Object> actionData;
    private boolean success;
    private String error;
    private String debugInfo;  // For prompt injection demos
}
