package com.smartlife.manager.repository;

import com.smartlife.manager.model.RecurringExpense;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecurringExpenseRepository extends JpaRepository<RecurringExpense, Long> {
    List<RecurringExpense> findByUserId(Long userId);
    List<RecurringExpense> findByDueDay(Integer dueDay);
}

