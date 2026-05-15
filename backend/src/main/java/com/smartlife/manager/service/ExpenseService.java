package com.smartlife.manager.service;

import com.smartlife.manager.model.Expense;
import com.smartlife.manager.model.FinancialProfile;
import com.smartlife.manager.model.RecurringExpense;
import com.smartlife.manager.repository.ExpenseRepository;
import com.smartlife.manager.repository.FinancialProfileRepository;
import com.smartlife.manager.repository.RecurringExpenseRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class ExpenseService {
    private final ExpenseRepository expenseRepository;
    private final RecurringExpenseRepository recurringExpenseRepository;
    private final FinancialProfileRepository financialProfileRepository;
    private final UserService userService;

    public ExpenseService(
            ExpenseRepository expenseRepository,
            RecurringExpenseRepository recurringExpenseRepository,
            FinancialProfileRepository financialProfileRepository,
            UserService userService) {
        this.expenseRepository = expenseRepository;
        this.recurringExpenseRepository = recurringExpenseRepository;
        this.financialProfileRepository = financialProfileRepository;
        this.userService = userService;
    }

    public Expense addExpense(Long userId, Expense expense) {
        expense.setUser(userService.getUser(userId));
        if (expense.getExpenseDate() == null) {
            expense.setExpenseDate(LocalDate.now());
        }
        return expenseRepository.save(expense);
    }

    public List<Expense> listExpenses(Long userId) {
        return expenseRepository.findByUserIdOrderByExpenseDateDesc(userId);
    }

    public void deleteExpense(Long id) {
        expenseRepository.deleteById(id);
    }

    public RecurringExpense addRecurring(Long userId, RecurringExpense expense) {
        expense.setUser(userService.getUser(userId));
        return recurringExpenseRepository.save(expense);
    }

    public List<RecurringExpense> listRecurring(Long userId) {
        return recurringExpenseRepository.findByUserId(userId);
    }

    public Map<String, Object> analysis(Long userId) {
        YearMonth currentMonth = YearMonth.now();
        List<Expense> expenses = expenseRepository.findByUserIdAndExpenseDateBetween(
                userId,
                currentMonth.atDay(1),
                currentMonth.atEndOfMonth());

        Map<String, Double> byCategory = expenses.stream()
                .collect(Collectors.groupingBy(
                        Expense::getCategory,
                        LinkedHashMap::new,
                        Collectors.summingDouble(expense -> expense.getAmount().doubleValue())));

        double total = byCategory.values().stream().mapToDouble(Double::doubleValue).sum();
        String topCategory = byCategory.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("None");
        String insight = total == 0
                ? "Add your first expense to unlock spending insights."
                : "Highest spending this month is on " + topCategory + ".";

        return Map.of("categoryTotals", byCategory, "monthTotal", total, "insight", insight);
    }

    public FinancialProfile saveProfile(Long userId, FinancialProfile request) {
        FinancialProfile profile = getOrCreateProfile(userId);
        profile.setMonthlySalary(valueOrZero(request.getMonthlySalary()));
        profile.setTotalSavings(valueOrZero(request.getTotalSavings()));
        profile.setSpendingLimit(valueOrZero(request.getSpendingLimit()));
        return financialProfileRepository.save(profile);
    }

    public FinancialProfile getProfile(Long userId) {
        return getOrCreateProfile(userId);
    }

    public Map<String, Object> summary(Long userId, String range) {
        FinancialProfile profile = getOrCreateProfile(userId);
        LocalDate today = LocalDate.now();
        LocalDate start = switch (range == null ? "month" : range.toLowerCase()) {
            case "day" -> today;
            case "week" -> today.with(DayOfWeek.MONDAY);
            default -> YearMonth.from(today).atDay(1);
        };

        List<Expense> expenses = expenseRepository.findByUserIdAndExpenseDateBetween(userId, start, today);
        BigDecimal total = expenses.stream()
                .map(Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal remaining = valueOrZero(profile.getMonthlySalary()).subtract(total);
        BigDecimal savingsRate = BigDecimal.ZERO;
        if (profile.getMonthlySalary() != null && profile.getMonthlySalary().compareTo(BigDecimal.ZERO) > 0) {
            savingsRate = remaining.max(BigDecimal.ZERO)
                    .multiply(BigDecimal.valueOf(100))
                    .divide(profile.getMonthlySalary(), 1, RoundingMode.HALF_UP);
        }

        Map<String, BigDecimal> dailyTotals = expenses.stream()
                .collect(Collectors.groupingBy(
                        expense -> expense.getExpenseDate().toString(),
                        LinkedHashMap::new,
                        Collectors.reducing(BigDecimal.ZERO, Expense::getAmount, BigDecimal::add)));

        String alert = "";
        if (profile.getSpendingLimit() != null
                && profile.getSpendingLimit().compareTo(BigDecimal.ZERO) > 0
                && total.compareTo(profile.getSpendingLimit()) > 0) {
            alert = "Spending limit exceeded.";
        } else if (profile.getMonthlySalary() != null
                && profile.getMonthlySalary().compareTo(BigDecimal.ZERO) > 0
                && remaining.compareTo(profile.getMonthlySalary().multiply(BigDecimal.valueOf(0.15))) < 0) {
            alert = "Salary is nearly exhausted.";
        }

        return Map.of(
                "monthlySalary", valueOrZero(profile.getMonthlySalary()),
                "totalSavings", valueOrZero(profile.getTotalSavings()),
                "totalExpenses", total,
                "remainingBalance", remaining,
                "savingsRate", savingsRate,
                "dailyTotals", dailyTotals,
                "alert", alert);
    }

    public Map<String, Object> closeMonth(Long userId) {
        FinancialProfile profile = getOrCreateProfile(userId);
        Map<String, Object> monthSummary = summary(userId, "month");
        BigDecimal remaining = (BigDecimal) monthSummary.get("remainingBalance");
        if (remaining.compareTo(BigDecimal.ZERO) > 0) {
            profile.setTotalSavings(valueOrZero(profile.getTotalSavings()).add(remaining));
            financialProfileRepository.save(profile);
        }
        return Map.of("totalSavings", profile.getTotalSavings(), "addedSavings", remaining.max(BigDecimal.ZERO));
    }

    private FinancialProfile getOrCreateProfile(Long userId) {
        return financialProfileRepository.findByUserId(userId)
                .orElseGet(() -> {
                    FinancialProfile profile = new FinancialProfile();
                    profile.setUser(userService.getUser(userId));
                    return financialProfileRepository.save(profile);
                });
    }

    private BigDecimal valueOrZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
