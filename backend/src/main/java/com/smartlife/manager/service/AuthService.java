package com.smartlife.manager.service;

import com.smartlife.manager.model.User;
import com.smartlife.manager.repository.UserRepository;
import java.util.Map;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final OtpService otpService;

    public AuthService(UserRepository userRepository, BCryptPasswordEncoder passwordEncoder, OtpService otpService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.otpService = otpService;
    }

    public Map<String, Object> register(String email, String password, String otp) {
        if (!otpService.validateOtp(email, otp)) {
            throw new IllegalArgumentException("Invalid or expired OTP");
        }

        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("Email already registered");
        }

        User user = new User();
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        User saved = userRepository.save(user);
        return Map.of("userId", saved.getId(), "email", saved.getEmail());
    }

    public Map<String, Object> login(String email, String password) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));
        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new IllegalArgumentException("Invalid email or password");
        }
        return Map.of("userId", user.getId(), "email", user.getEmail());
    }

    public Map<String, Object> authenticateWithFirebase(String idToken) {
        try {
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(idToken);
            String uid = decodedToken.getUid();
            String email = decodedToken.getEmail();

            User user = userRepository.findByFirebaseUid(uid).orElseGet(() -> {
                return userRepository.findByEmail(email).map(existingUser -> {
                    existingUser.setFirebaseUid(uid);
                    return userRepository.save(existingUser);
                }).orElseGet(() -> {
                    User newUser = new User();
                    newUser.setEmail(email);
                    newUser.setFirebaseUid(uid);
                    return userRepository.save(newUser);
                });
            });

            return Map.of("userId", user.getId(), "email", user.getEmail());
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid Firebase Token");
        }
    }

    public Map<String, Object> updateEmail(Long userId, String newEmail, String otp) {
        if (!otpService.validateOtp(newEmail, otp)) {
            throw new IllegalArgumentException("Invalid or expired OTP");
        }
        
        if (userRepository.existsByEmail(newEmail)) {
            throw new IllegalArgumentException("Email already in use");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        
        user.setEmail(newEmail);
        userRepository.save(user);
        return Map.of("userId", user.getId(), "email", user.getEmail());
    }
}

