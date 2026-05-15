package com.smartlife.manager.service;

import com.smartlife.manager.model.Expense;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ExportService {
    private final ExpenseService expenseService;

    public ExportService(ExpenseService expenseService) {
        this.expenseService = expenseService;
    }

    public byte[] expensesCsv(Long userId) {
        StringBuilder csv = new StringBuilder("Date,Description,Category,Amount\n");
        for (Expense expense : expenseService.listExpenses(userId)) {
            csv.append(expense.getExpenseDate()).append(',')
                    .append(clean(expense.getDescription())).append(',')
                    .append(clean(expense.getCategory())).append(',')
                    .append(expense.getAmount()).append('\n');
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    public byte[] expensesPdf(Long userId) {
        List<Expense> expenses = expenseService.listExpenses(userId);
        StringBuilder lines = new StringBuilder("Smart Life Expense Report\\n\\n");
        for (Expense expense : expenses) {
            lines.append(expense.getExpenseDate())
                    .append("  ")
                    .append(clean(expense.getCategory()))
                    .append("  Rs ")
                    .append(expense.getAmount())
                    .append("\\n");
        }
        return simplePdf(lines.toString());
    }

    private String clean(String value) {
        return value == null ? "" : value.replace(",", " ").replace("\n", " ");
    }

    private byte[] simplePdf(String text) {
        String escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)");
        String stream = "BT /F1 14 Tf 50 780 Td 18 TL (" + escaped.replace("\\n", ") Tj T* (") + ") Tj ET";
        String pdf = "%PDF-1.4\n"
                + "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
                + "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
                + "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n"
                + "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
                + "5 0 obj << /Length " + stream.length() + " >> stream\n"
                + stream + "\nendstream endobj\n"
                + "xref\n0 6\n0000000000 65535 f \n"
                + "trailer << /Root 1 0 R /Size 6 >>\nstartxref\n0\n%%EOF";
        return pdf.getBytes(StandardCharsets.UTF_8);
    }
}

