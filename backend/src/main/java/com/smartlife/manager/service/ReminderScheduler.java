package com.smartlife.manager.service;

import com.smartlife.manager.model.Lending;
import com.smartlife.manager.model.RecurringExpense;
import com.smartlife.manager.model.Todo;
import com.smartlife.manager.model.TodoStatus;
import com.smartlife.manager.repository.LendingRepository;
import com.smartlife.manager.repository.RecurringExpenseRepository;
import com.smartlife.manager.repository.TodoRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class ReminderScheduler {
    private final RecurringExpenseRepository recurringExpenseRepository;
    private final LendingRepository lendingRepository;
    private final TodoRepository todoRepository;
    private final NotificationService notificationService;

    public ReminderScheduler(
            RecurringExpenseRepository recurringExpenseRepository,
            LendingRepository lendingRepository,
            TodoRepository todoRepository,
            NotificationService notificationService) {
        this.recurringExpenseRepository = recurringExpenseRepository;
        this.lendingRepository = lendingRepository;
        this.todoRepository = todoRepository;
        this.notificationService = notificationService;
    }

    @Scheduled(cron = "0 0 8 * * *")
    public void dailyReminderCheck() {
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        int dueDayTomorrow = tomorrow.getDayOfMonth();

        for (RecurringExpense expense : recurringExpenseRepository.findByDueDay(dueDayTomorrow)) {
            notificationService.create(
                    expense.getUser(),
                    expense.getName() + " due tomorrow: Rs " + expense.getAmount());
        }

        for (Lending lending : lendingRepository.findByDueDate(tomorrow)) {
            notificationService.create(
                    lending.getUser(),
                    "Money reminder tomorrow with " + lending.getPersonName() + ": Rs " + lending.getAmount());
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime nextDay = now.plusDays(1);
        for (Todo todo : todoRepository.findByStatusAndDeadlineBetween(TodoStatus.PENDING, now, nextDay)) {
            notificationService.create(todo.getUser(), "Task deadline coming soon: " + todo.getTask());
        }

        for (Todo todo : todoRepository.findByStatusAndDeadlineBefore(TodoStatus.PENDING, now)) {
            todo.setStatus(TodoStatus.MISSED);
            todoRepository.save(todo);
            notificationService.create(todo.getUser(), "Missed task: " + todo.getTask());
        }
    }
}

