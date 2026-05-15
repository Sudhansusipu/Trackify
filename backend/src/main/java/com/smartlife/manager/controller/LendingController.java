package com.smartlife.manager.controller;

import com.smartlife.manager.model.Lending;
import com.smartlife.manager.service.LendingService;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/lending")
public class LendingController {
    private final LendingService lendingService;

    public LendingController(LendingService lendingService) {
        this.lendingService = lendingService;
    }

    @PostMapping
    public Lending add(@RequestParam Long userId, @RequestBody Lending lending) {
        return lendingService.add(userId, lending);
    }

    @GetMapping
    public List<Lending> list(@RequestParam Long userId) {
        return lendingService.list(userId);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        lendingService.delete(id);
    }
}

