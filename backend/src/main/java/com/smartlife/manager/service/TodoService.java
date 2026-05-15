package com.smartlife.manager.service;

import com.smartlife.manager.model.Priority;
import com.smartlife.manager.model.RecurrenceType;
import com.smartlife.manager.model.Todo;
import com.smartlife.manager.model.TodoStatus;
import com.smartlife.manager.model.User;
import com.smartlife.manager.repository.TodoRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class TodoService {
    private final TodoRepository todoRepository;
    private final UserService userService;
    private final NotificationService notificationService;

    public TodoService(TodoRepository todoRepository, UserService userService, NotificationService notificationService) {
        this.todoRepository = todoRepository;
        this.userService = userService;
        this.notificationService = notificationService;
    }

    public Todo addTodo(Long userId, Todo todo) {
        todo.setUser(userService.getUser(userId));
        if (todo.getStatus() == null) {
            todo.setStatus(TodoStatus.PENDING);
        }
        if (todo.getPriority() == null) {
            todo.setPriority(Priority.MEDIUM);
        }
        if (todo.getRecurrence() == null) {
            todo.setRecurrence(RecurrenceType.NONE);
        }
        return todoRepository.save(todo);
    }

    public List<Todo> listTodos(Long userId) {
        return todoRepository.findByUserIdOrderByDeadlineAsc(userId);
    }

    public Todo complete(Long id) {
        Todo todo = todoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Todo not found"));
        todo.setStatus(TodoStatus.COMPLETED);
        Todo saved = todoRepository.save(todo);
        notificationService.create(todo.getUser(), "Task completed successfully: " + todo.getTask());
        createNextRecurringTask(todo);
        return saved;
    }

    public void delete(Long id) {
        todoRepository.deleteById(id);
    }

    public Map<String, Object> productivity(Long userId) {
        List<Todo> todos = todoRepository.findByUserIdOrderByDeadlineAsc(userId);
        int productive = todos.stream()
                .filter(todo -> todo.getPriority() == Priority.HIGH || todo.getPriority() == Priority.MEDIUM)
                .mapToInt(todo -> safeMinutes(todo.getMinutesSpent()))
                .sum();
        int waste = todos.stream()
                .filter(todo -> todo.getPriority() == Priority.LOW)
                .mapToInt(todo -> safeMinutes(todo.getMinutesSpent()))
                .sum();

        String insight = waste > productive
                ? "You are spending more time on low priority tasks. Focus on high priority tasks first."
                : "Good balance. Keep prioritizing important tasks.";

        return Map.of("productiveMinutes", productive, "wasteMinutes", waste, "insight", insight);
    }

    public Map<Priority, Long> priorityCounts(Long userId) {
        return todoRepository.findByUserIdOrderByDeadlineAsc(userId).stream()
                .collect(Collectors.groupingBy(Todo::getPriority, Collectors.counting()));
    }

    private int safeMinutes(Integer minutes) {
        return minutes == null ? 0 : minutes;
    }

    private void createNextRecurringTask(Todo todo) {
        if (todo.getRecurrence() == RecurrenceType.NONE || todo.getDeadline() == null) {
            return;
        }

        LocalDateTime nextDeadline = switch (todo.getRecurrence()) {
            case DAILY -> todo.getDeadline().plusDays(1);
            case WEEKLY -> todo.getDeadline().plusWeeks(1);
            case MONTHLY -> todo.getDeadline().plusMonths(1);
            default -> todo.getDeadline();
        };

        User user = todo.getUser();
        Todo next = new Todo();
        next.setUser(user);
        next.setTask(todo.getTask());
        next.setPriority(todo.getPriority());
        next.setDeadline(nextDeadline);
        next.setRecurrence(todo.getRecurrence());
        next.setStatus(TodoStatus.PENDING);
        todoRepository.save(next);
    }
}

