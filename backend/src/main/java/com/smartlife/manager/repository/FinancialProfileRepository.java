package com.smartlife.manager.repository;

import com.smartlife.manager.model.FinancialProfile;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FinancialProfileRepository extends JpaRepository<FinancialProfile, Long> {
    Optional<FinancialProfile> findByUserId(Long userId);
}

