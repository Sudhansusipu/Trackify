package com.smartlife.manager.service;

import com.smartlife.manager.model.Notification;
import com.smartlife.manager.model.User;
import com.smartlife.manager.repository.NotificationRepository;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class NotificationService {
    private final NotificationRepository notificationRepository;
    private final JavaMailSender mailSender;
    private final boolean mailEnabled;

    public NotificationService(
            NotificationRepository notificationRepository,
            JavaMailSender mailSender,
            @Value("${smartlife.mail.enabled:false}") boolean mailEnabled) {
        this.notificationRepository = notificationRepository;
        this.mailSender = mailSender;
        this.mailEnabled = mailEnabled;
    }

    public Notification create(User user, String message) {
        Notification notification = new Notification();
        notification.setUser(user);
        notification.setMessage(message);
        Notification saved = notificationRepository.save(notification);
        sendEmail(user.getEmail(), message);
        return saved;
    }

    public List<Notification> list(Long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public Notification markRead(Long id) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Notification not found"));
        notification.setReadStatus(true);
        return notificationRepository.save(notification);
    }

    private void sendEmail(String to, String body) {
        if (!mailEnabled) {
            return;
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject("Smart Life Manager Reminder");
        message.setText(body);
        mailSender.send(message);
    }
}

