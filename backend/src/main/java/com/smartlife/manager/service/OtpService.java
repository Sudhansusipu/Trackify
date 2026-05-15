package com.smartlife.manager.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class OtpService {

    private final JavaMailSender mailSender;
    private final SecureRandom secureRandom = new SecureRandom();
    
    // Store OTPs with timestamp (Email -> OTPData)
    private final Map<String, OtpData> otpCache = new ConcurrentHashMap<>();
    
    @Value("${smartlife.mail.enabled:false}")
    private boolean mailEnabled;

    public OtpService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void generateAndSendOtp(String email) {
        // Generate a 6-digit OTP
        String otp = String.format("%06d", secureRandom.nextInt(1000000));
        
        // Cache it for 5 minutes
        otpCache.put(email, new OtpData(otp, System.currentTimeMillis() + (5 * 60 * 1000)));

        if (mailEnabled) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setTo(email);
                message.setSubject("Trackify - Your Verification Code");
                message.setText("Your OTP code is: " + otp + "\nThis code will expire in 5 minutes.");
                mailSender.send(message);
                System.out.println("OTP sent to " + email);
            } catch (Exception e) {
                System.err.println("Failed to send OTP email: " + e.getMessage());
                System.out.println("FALLBACK LOG - Your OTP code for " + email + " is: " + otp);
            }
        } else {
            System.out.println("MAIL DISABLED. OTP for " + email + " is: " + otp);
        }
    }

    public boolean validateOtp(String email, String inputOtp) {
        OtpData data = otpCache.get(email);
        if (data == null) {
            return false;
        }
        
        if (System.currentTimeMillis() > data.expiryTime) {
            otpCache.remove(email); // Expired
            return false;
        }
        
        if (data.otp.equals(inputOtp)) {
            otpCache.remove(email); // Validated, remove from cache
            return true;
        }
        return false;
    }

    private static class OtpData {
        String otp;
        long expiryTime;

        public OtpData(String otp, long expiryTime) {
            this.otp = otp;
            this.expiryTime = expiryTime;
        }
    }
}
