package com.smartlife.manager.controller;

import com.smartlife.manager.service.AuthService;
import com.smartlife.manager.service.OtpService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    private final OtpService otpService;

    public AuthController(AuthService authService, OtpService otpService) {
        this.authService = authService;
        this.otpService = otpService;
    }

    @PostMapping("/request-otp")
    public ResponseEntity<Map<String, String>> requestOtp(@RequestBody Map<String, String> request) {
        otpService.generateAndSendOtp(request.get("email"));
        return ResponseEntity.ok(Map.of("message", "OTP sent successfully"));
    }

    @PostMapping("/register")
    public Map<String, Object> register(@RequestBody Map<String, String> request) {
        return authService.register(request.get("email"), request.get("password"), request.get("otp"));
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> request) {
        return authService.login(request.get("email"), request.get("password"));
    }

    @PostMapping("/firebase")
    public Map<String, Object> firebaseAuth(@RequestBody Map<String, String> request) {
        return authService.authenticateWithFirebase(request.get("token"));
    }

    @PutMapping("/email")
    public Map<String, Object> updateEmail(@RequestBody Map<String, String> request) {
        Long userId = Long.parseLong(request.get("userId"));
        return authService.updateEmail(userId, request.get("newEmail"), request.get("otp"));
    }
}

