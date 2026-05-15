package com.smartlife.manager.controller;

import com.smartlife.manager.model.Expense;
import com.smartlife.manager.model.FinancialProfile;
import com.smartlife.manager.model.RecurringExpense;
import com.smartlife.manager.service.ExportService;
import com.smartlife.manager.service.ExpenseService;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/expenses")
public class ExpenseController {
    private final ExpenseService expenseService;
    private final ExportService exportService;

    public ExpenseController(ExpenseService expenseService, ExportService exportService) {
        this.expenseService = expenseService;
        this.exportService = exportService;
    }

    @PostMapping
    public Expense add(@RequestParam Long userId, @RequestBody Expense expense) {
        return expenseService.addExpense(userId, expense);
    }

    @GetMapping
    public List<Expense> list(@RequestParam Long userId) {
        return expenseService.listExpenses(userId);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        expenseService.deleteExpense(id);
    }

    @PostMapping("/recurring")
    public RecurringExpense addRecurring(@RequestParam Long userId, @RequestBody RecurringExpense expense) {
        return expenseService.addRecurring(userId, expense);
    }

    @GetMapping("/recurring")
    public List<RecurringExpense> recurring(@RequestParam Long userId) {
        return expenseService.listRecurring(userId);
    }

    @GetMapping("/analysis")
    public Map<String, Object> analysis(@RequestParam Long userId) {
        return expenseService.analysis(userId);
    }

    @PostMapping("/profile")
    public FinancialProfile saveProfile(@RequestParam Long userId, @RequestBody FinancialProfile profile) {
        return expenseService.saveProfile(userId, profile);
    }

    @GetMapping("/profile")
    public FinancialProfile profile(@RequestParam Long userId) {
        return expenseService.getProfile(userId);
    }

    @GetMapping("/summary")
    public Map<String, Object> summary(@RequestParam Long userId, @RequestParam(defaultValue = "month") String range) {
        return expenseService.summary(userId, range);
    }

    @PostMapping("/close-month")
    public Map<String, Object> closeMonth(@RequestParam Long userId) {
        return expenseService.closeMonth(userId);
    }

    @GetMapping("/export/excel")
    public ResponseEntity<byte[]> exportExcel(@RequestParam Long userId) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=smart-life-expenses.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(exportService.expensesCsv(userId));
    }

    @GetMapping("/export/pdf")
    public ResponseEntity<byte[]> exportPdf(@RequestParam Long userId) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=smart-life-expenses.pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(exportService.expensesPdf(userId));
    }
}
