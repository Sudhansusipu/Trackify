package com.smartlife.manager.controller;

import com.smartlife.manager.model.Todo;
import com.smartlife.manager.service.TodoService;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/todos")
public class TodoController {
    private final TodoService todoService;

    public TodoController(TodoService todoService) {
        this.todoService = todoService;
    }

    @PostMapping
    public Todo add(@RequestParam Long userId, @RequestBody Todo todo) {
        return todoService.addTodo(userId, todo);
    }

    @GetMapping
    public List<Todo> list(@RequestParam Long userId) {
        return todoService.listTodos(userId);
    }

    @PutMapping("/{id}/complete")
    public Todo complete(@PathVariable Long id) {
        return todoService.complete(id);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        todoService.delete(id);
    }

    @GetMapping("/productivity")
    public Map<String, Object> productivity(@RequestParam Long userId) {
        return todoService.productivity(userId);
    }
}

