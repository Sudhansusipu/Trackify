package com.smartlife.manager.controller;

import com.smartlife.manager.model.Notification;
import com.smartlife.manager.service.NotificationService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public List<Notification> list(@RequestParam Long userId) {
        return notificationService.list(userId);
    }

    @PutMapping("/{id}/read")
    public Notification read(@PathVariable Long id) {
        return notificationService.markRead(id);
    }
}

