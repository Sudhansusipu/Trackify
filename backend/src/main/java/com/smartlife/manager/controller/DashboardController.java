package com.smartlife.manager.controller;

import com.smartlife.manager.service.ExpenseService;
import com.smartlife.manager.service.NotificationService;
import com.smartlife.manager.service.TodoService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
    private final ExpenseService expenseService;
    private final TodoService todoService;
    private final NotificationService notificationService;

    public DashboardController(
            ExpenseService expenseService,
            TodoService todoService,
            NotificationService notificationService) {
        this.expenseService = expenseService;
        this.todoService = todoService;
        this.notificationService = notificationService;
    }

    @GetMapping
    public Map<String, Object> dashboard(@RequestParam Long userId) {
        return Map.of(
                "expenseAnalysis", expenseService.analysis(userId),
                "productivity", todoService.productivity(userId),
                "notifications", notificationService.list(userId));
    }
}

