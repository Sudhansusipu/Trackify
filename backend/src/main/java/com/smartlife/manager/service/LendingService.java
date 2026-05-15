package com.smartlife.manager.service;

import com.smartlife.manager.model.Lending;
import com.smartlife.manager.repository.LendingRepository;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class LendingService {
    private final LendingRepository lendingRepository;
    private final UserService userService;

    public LendingService(LendingRepository lendingRepository, UserService userService) {
        this.lendingRepository = lendingRepository;
        this.userService = userService;
    }

    public Lending add(Long userId, Lending lending) {
        lending.setUser(userService.getUser(userId));
        return lendingRepository.save(lending);
    }

    public List<Lending> list(Long userId) {
        return lendingRepository.findByUserIdOrderByDueDateAsc(userId);
    }

    public void delete(Long id) {
        lendingRepository.deleteById(id);
    }
}

