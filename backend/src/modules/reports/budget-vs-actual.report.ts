import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { GenerateReportBody } from '../../contracts';
import { Budget, BudgetPeriodType, BudgetRolloverMode } from '../../entities/budget.entity';
import { Category } from '../../entities/category.entity';
import { CurrencyConverter, normalizeCurrencyCode } from '../exchange-rates/currency-converter';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { categoryFamily, overlap, plannedForWindow } from './budget-variance.util';
import type { ReportCell, ReportDocument } from './report-document.util';
import type { TemplateLabels, TemplateReportRow } from './report-template.types';

interface BudgetLine {
  budget: Budget;
  window: { from: string; to: string };
  family: Set<string>;
  planned: number;
  actual: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Budget vs Actual: what each budget allowed over the report period against
 * what was spent in its category and everything under it.
 *
 * Built from the same counted, converted rows as the other templates, so the
 * spending in this document and in the P&L for the same period agree: what no
 * budget covers is listed in its own section rather than dropped.
 */
@Injectable()
export class BudgetVsActualReport {
  constructor(
    @InjectRepository(Budget)
    private readonly budgetRepository: Repository<Budget>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  async build(
    workspaceId: string,
    dto: GenerateReportBody,
    text: TemplateLabels,
    subtitle: string,
    currency: string,
    rows: TemplateReportRow[],
  ): Promise<{ document: ReportDocument; missingRates: string[] }> {
    const period = { from: dto.dateFrom, to: dto.dateTo };
    const [budgets, categories] = await Promise.all([
      this.budgetRepository.find({
        where: { workspaceId },
        relations: {
          category: {
            parent: true,
          },

          goal: true,
        },
      }),
      this.categoryRepository.find({
        where: { workspaceId },
        select: {
          id: true,
          parentId: true,
        },
      }),
    ]);
    const parentOf = new Map(categories.map(category => [category.id, category.parentId ?? null]));

    const inScope = budgets.filter(
      budget =>
        // A budget kept for a goal that was archived no longer plans anything.
        !(budget.goalId && !budget.goal) &&
        (!dto.categoryIds?.length || dto.categoryIds.includes(budget.categoryId)),
    );
    const windows = inScope
      .map(budget => ({
        budget,
        window: overlap(period, { from: budget.startsOn, to: budget.endsOn }),
      }))
      .filter((entry): entry is { budget: Budget; window: { from: string; to: string } } =>
        Boolean(entry.window),
      );

    // A limit converts at the rate of the last day it governs in this report.
    const converter = await CurrencyConverter.load(
      this.exchangeRatesService,
      currency,
      windows.map(({ budget, window }) => ({
        currency: normalizeCurrencyCode(budget.currency),
        date: window.to,
      })),
      workspaceId,
    );

    const expenses = rows.filter(row => !row.isIncome);
    const lines: BudgetLine[] = windows.map(({ budget, window }) => {
      const family = categoryFamily(budget.categoryId, parentOf);
      const planned = converter.convert(
        plannedForWindow(Number(budget.limitAmount), budget.periodType, window),
        normalizeCurrencyCode(budget.currency),
        window.to,
      );
      // Spending counts only inside the budget's own window, as its plan does.
      const actual = expenses
        .filter(
          row => family.has(row.categoryKey) && row.date >= window.from && row.date <= window.to,
        )
        .reduce((sum, row) => sum + row.amount, 0);
      return { budget, window, family, planned, actual };
    });
    lines.sort((a, b) => a.planned - a.actual - (b.planned - b.actual));

    // A row two budgets cover (with and without a goal) is spent once, so the
    // total is taken over rows, not over budget lines.
    const covered = (row: TemplateReportRow): boolean =>
      lines.some(
        line =>
          line.family.has(row.categoryKey) &&
          row.date >= line.window.from &&
          row.date <= line.window.to,
      );
    const plannedTotal = lines.reduce((sum, line) => sum + line.planned, 0);
    const actualTotal = expenses.filter(covered).reduce((sum, row) => sum + row.amount, 0);
    const outside = this.outsideBudgets(expenses.filter(row => !covered(row)));
    const outsideTotal = outside.reduce((sum, entry) => sum + entry.total, 0);

    const notes = lines.some(line => line.budget.rolloverMode !== BudgetRolloverMode.NONE)
      ? [text.rolloverNote]
      : undefined;

    const document: ReportDocument = {
      title: text.titleBudgetVsActual,
      subtitle,
      ...(notes ? { notes } : {}),
      sections: [
        {
          columns: [
            text.group,
            text.category,
            text.budget,
            text.budgetPeriod,
            text.planned,
            text.actual,
            text.variance,
            text.usedPercent,
          ],
          rows: lines.map(line => this.toRow(line, text, period)),
          total: [
            text.total,
            '',
            '',
            '',
            round2(plannedTotal),
            round2(actualTotal),
            round2(plannedTotal - actualTotal),
            plannedTotal > 0 ? Math.round((actualTotal / plannedTotal) * 100) : '',
          ],
        },
        {
          title: text.outsideBudgets,
          columns: [text.group, text.category, text.amount],
          rows: outside.map(entry => [entry.groupName, entry.categoryName, round2(entry.total)]),
          total: [text.total, '', round2(outsideTotal)],
        },
      ],
      footer: [[text.totalExpenses, round2(actualTotal + outsideTotal)]],
    };

    return { document, missingRates: converter.missing };
  }

  private toRow(
    line: BudgetLine,
    text: TemplateLabels,
    period: { from: string; to: string },
  ): ReportCell[] {
    const { budget, window, planned, actual } = line;
    const categoryName = budget.category?.name ?? '';
    const clipped = window.from !== period.from || window.to !== period.to;
    return [
      budget.category?.parent?.name ?? '',
      categoryName,
      budget.goal ? `${budget.name} · ${budget.goal.name}` : budget.name,
      clipped
        ? `${this.periodLabel(budget.periodType, text)} (${window.from} — ${window.to})`
        : this.periodLabel(budget.periodType, text),
      round2(planned),
      round2(actual),
      round2(planned - actual),
      planned > 0 ? Math.round((actual / planned) * 100) : '',
    ];
  }

  private periodLabel(periodType: BudgetPeriodType, text: TemplateLabels): string {
    switch (periodType) {
      case BudgetPeriodType.WEEKLY:
        return text.periodWeekly;
      case BudgetPeriodType.QUARTERLY:
        return text.periodQuarterly;
      case BudgetPeriodType.ANNUAL:
        return text.periodAnnual;
      default:
        return text.periodMonthly;
    }
  }

  /** Spending no budget covers, by category, largest first. */
  private outsideBudgets(
    rows: TemplateReportRow[],
  ): Array<{ groupName: string; categoryName: string; total: number }> {
    const totals = new Map<string, { groupName: string; categoryName: string; total: number }>();
    for (const row of rows) {
      const entry = totals.get(row.categoryKey) ?? {
        groupName: row.groupName,
        categoryName: row.categoryName,
        total: 0,
      };
      entry.total += row.amount;
      totals.set(row.categoryKey, entry);
    }
    return Array.from(totals.values()).sort((a, b) => b.total - a.total);
  }
}
