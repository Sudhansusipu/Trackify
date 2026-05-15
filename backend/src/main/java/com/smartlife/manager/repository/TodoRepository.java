package com.smartlife.manager.repository;

import com.smartlife.manager.model.Todo;
import com.smartlife.manager.model.TodoStatus;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TodoRepository extends JpaRepository<Todo, Long> {
    List<Todo> findByUserIdOrderByDeadlineAsc(Long userId);
    List<Todo> findByStatusAndDeadlineBefore(TodoStatus status, LocalDateTime deadline);
    List<Todo> findByStatusAndDeadlineBetween(TodoStatus status, LocalDateTime start, LocalDateTime end);
}

