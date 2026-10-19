import { countedSql } from '@/common/utils/counted-transactions.util';
import { TransactionType } from "../../../src/entities/transaction.entity";
import { TransactionsSource } from "../../../src/modules/custom-tables/sources/transactions.source";

const createQueryBuilderMock = (rows: unknown[]) => {
	const qb: Record<string, jest.Mock> = {};
	for (const method of [
		"leftJoinAndSelect",
		"where",
		"andWhere",
		"orderBy",
		"addOrderBy",
		"take",
	]) {
		qb[method] = jest.fn().mockReturnValue(qb);
	}
	qb.getMany = jest.fn().mockResolvedValue(rows);
	return qb;
};

describe("TransactionsSource", () => {
	it("maps transactions to signed amounts, ISO dates and joined labels", async () => {
		const qb = createQueryBuilderMock([
			{
				id: "tx-1",
				transactionDate: new Date("2026-09-03T10:00:00.000Z"),
				counterpartyName: "Magnum",
				paymentPurpose: "Groceries",
				debit: 500,
				credit: null,
				amount: null,
				currency: "KZT",
				transactionType: TransactionType.EXPENSE,
				category: { name: "Food" },
				statement: { fileName: "sept.pdf" },
			},
			{
				id: "tx-2",
				transactionDate: "2026-09-04",
				counterpartyName: null,
				paymentPurpose: null,
				debit: null,
				credit: null,
				amount: "1200.50",
				currency: "KZT",
				transactionType: TransactionType.INCOME,
				category: null,
				statement: null,
			},
		]);
		const source = new TransactionsSource({
			createQueryBuilder: () => qb,
		} as never);

		const rows = await source.fetchRows("workspace-1", {});

		expect(rows).toEqual([
			{
				sourceKey: "tx-1",
				values: {
					date: "2026-09-03",
					counterparty: "Magnum",
					purpose: "Groceries",
					amount: -500,
					type: "expense",
					category: "Food",
					currency: "KZT",
					statement: "sept.pdf",
				},
			},
			{
				sourceKey: "tx-2",
				values: {
					date: "2026-09-04",
					counterparty: "",
					purpose: "",
					amount: 1200.5,
					type: "income",
					category: "",
					currency: "KZT",
					statement: "",
				},
			},
		]);
		expect(qb.where).toHaveBeenCalledWith("tx.workspaceId = :workspaceId", {
			workspaceId: "workspace-1",
		});
		expect(qb.andWhere).toHaveBeenCalledWith(
			"(tx.statementId IS NULL OR statement.deletedAt IS NULL)",
		);
	});

	it("fills tables from confirmed transactions only", async () => {
		const qb = createQueryBuilderMock([]);
		const source = new TransactionsSource({
			createQueryBuilder: () => qb,
		} as never);

		await source.fetchRows("workspace-1", {});

		expect(qb.andWhere).toHaveBeenCalledWith(countedSql('tx'));
	});

	it("applies period, type, category, currency and statement filters", async () => {
		const qb = createQueryBuilderMock([]);
		const source = new TransactionsSource({
			createQueryBuilder: () => qb,
		} as never);

		await source.fetchRows("workspace-1", {
			dateFrom: "2026-09-01",
			dateTo: "2026-09-30",
			type: "expense",
			categoryIds: ["cat-1"],
			currency: "eur",
			statementIds: ["st-1"],
		});

		const clauses = qb.andWhere.mock.calls.map((call) => call[0]);
		expect(clauses).toEqual(
			expect.arrayContaining([
				"tx.transactionDate >= :dateFrom",
				"tx.transactionDate <= :dateTo",
				"tx.transactionType = :type",
				"tx.categoryId IN (:...categoryIds)",
				"UPPER(tx.currency) = :currency",
				"tx.statementId IN (:...statementIds)",
			]),
		);
		expect(qb.andWhere).toHaveBeenCalledWith("UPPER(tx.currency) = :currency", {
			currency: "EUR",
		});
	});

	it("rejects an unknown type filter instead of silently returning everything", async () => {
		const source = new TransactionsSource({
			createQueryBuilder: () => createQueryBuilderMock([]),
		} as never);
		await expect(
			source.fetchRows("workspace-1", { type: "refund" }),
		).rejects.toMatchObject({
			response: expect.objectContaining({ code: "SOURCE_FILTER_INVALID" }),
		});
	});
});
