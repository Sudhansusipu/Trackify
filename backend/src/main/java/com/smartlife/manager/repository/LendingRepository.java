package com.smartlife.manager.repository;

import com.smartlife.manager.model.Lending;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LendingRepository extends JpaRepository<Lending, Long> {
    List<Lending> findByUserIdOrderByDueDateAsc(Long userId);
    List<Lending> findByDueDate(LocalDate dueDate);
}

