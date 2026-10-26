import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { EntityType } from "../../../src/entities/audit-event.entity";
import { UserRole } from "../../../src/entities/user.entity";
import { WorkspaceRole } from "../../../src/entities/workspace-member.entity";
import { SourceWriteBackService } from "../../../src/modules/custom-tables/write-back/source-write-back.service";

const WS = "ws-1";
const USER = "user-1";
const TABLE = { id: "table-1", sourceBinding: { kind: "transactions" } };
const TX = "tx-1";

type Edit = {
	id: string;
	workspaceId: string;
	tableId: string;
	sourceKind: string;
	sourceKey: string;
	originalValues: Record<string, unknown>;
	writtenValues: Record<string, unknown>;
	meta: Record<string, unknown> | null;
	userId: string | null;
	createdAt: Date;
};

/** An in-memory journal with the repository methods the service calls. */
const journal = () => {
	const rows: Edit[] = [];
	let seq = 0;
	return {
		rows,
		findOne: vi.fn(async ({ where }: { where: Partial<Edit> }) =>
			rows.find(row =>
				Object.entries(where).every(([key, value]) => row[key as keyof Edit] === value),
			) ?? null,
		),
		find: vi.fn(async ({ where }: { where: Partial<Edit> }) =>
			rows.filter(row =>
				Object.entries(where).every(([key, value]) => row[key as keyof Edit] === value),
			),
		),
		create: vi.fn((value: Partial<Edit>) => ({ ...value }) as Edit),
		save: vi.fn(async (value: Edit) => {
			if (!value.id) {
				seq += 1;
				value.id = `edit-${seq}`;
				value.createdAt = new Date(seq);
				rows.push(value);
			}
			return value;
		}),
		delete: vi.fn(async (ids: string | string[]) => {
			for (const id of Array.isArray(ids) ? ids : [ids]) {
				const index = rows.findIndex(row => row.id === id);
				if (index >= 0) {
					rows.splice(index, 1);
				}
			}
		}),
	};
};

const setup = (options: { role?: WorkspaceRole | null; globalAdmin?: boolean } = {}) => {
	// The transaction the table shows; the domain mock changes it like the real service.
	const records: Record<string, Record<string, unknown>> = {
		[TX]: { amount: -650, type: "expense", category: "Rent", currency: "EUR", statement: "a.csv" },
	};
	const edits = journal();
	const memberRepository = {
		findOne: vi.fn().mockResolvedValue(
			options.role === null
				? null
				: { id: "member-1", role: options.role ?? WorkspaceRole.OWNER, permissions: null },
		),
	};
	const userRepository = {
		findOne: vi
			.fn()
			.mockResolvedValue({ id: USER, role: options.globalAdmin ? UserRole.ADMIN : UserRole.USER }),
	};
	const categoryRepository = {
		findOne: vi.fn(async ({ where }: { where: { id: string } }) => ({
			id: where.id,
			name: { "cat-rent": "Rent", "cat-travel": "Travel" }[where.id],
		})),
		find: vi.fn().mockResolvedValue([
			{ id: "cat-rent", name: "Rent", type: "expense", isEnabled: true },
			{ id: "cat-travel-income", name: "Travel", type: "income", isEnabled: true },
			{ id: "cat-travel", name: "Travel", type: "expense", isEnabled: true },
			{ id: "cat-old", name: "Old", type: "expense", isEnabled: false },
		]),
	};
	const clientRepository = { find: vi.fn().mockResolvedValue([]) };
	// The transaction's document: a bank statement unless a test says otherwise.
	const statement = { id: "stmt-1", parsingDetails: { detectedBy: "csv" } as { detectedBy?: string } };
	const receipts: Array<{ id: string; parsedData: Record<string, unknown> | null }> = [];
	const transactionRepository = {
		findOne: vi.fn(async () => ({
			id: TX,
			statementId: statement.id,
			categoryId: categoryIdByName[String(records[TX]?.category)] ?? null,
		})),
	};
	const statementRepository = {
		findOne: vi.fn(async () => statement),
		update: vi.fn().mockResolvedValue(undefined),
	};
	const receiptRepository = {
		find: vi.fn(async () => receipts),
		save: vi.fn(async (value: unknown) => value),
	};
	const adapter = {
		fetchRows: vi.fn(async (_ws: string, filters: { ids?: string[] }) =>
			(filters.ids ?? [])
				.filter(id => records[id])
				.map(id => ({ sourceKey: id, values: { ...records[id] } })),
		),
	};
	const sources = { get: vi.fn().mockReturnValue(adapter) };
	const auditService = { createEvent: vi.fn().mockResolvedValue(undefined) };
	const categoryIdByName: Record<string, string> = { Rent: "cat-rent", Travel: "cat-travel" };
	const categoryNames: Record<string, string> = {
		"cat-rent": "Rent",
		"cat-travel": "Travel",
		"cat-travel-income": "Travel",
	};
	const transactions = {
		update: vi.fn(async (id: string, _ws: string, _user: string, dto: Record<string, unknown>) => {
			const record = records[id];
			if (dto.debit != null) {
				record.amount = -Number(dto.debit);
				record.type = "expense";
			}
			if (dto.credit != null) {
				record.amount = Number(dto.credit);
				record.type = "income";
			}
			if ("categoryId" in dto) {
				record.category = dto.categoryId ? categoryNames[dto.categoryId as string] : "";
			}
			if (dto.currency) {
				record.currency = dto.currency;
			}
			return record;
		}),
	};
	const payables = {
		findOne: vi.fn(),
		update: vi.fn(),
		markAsPaid: vi.fn(),
		archive: vi.fn(),
		listPayments: vi.fn().mockResolvedValue([]),
		removePayment: vi.fn(),
	};
	const service = new SourceWriteBackService(
		edits as never,
		memberRepository as never,
		userRepository as never,
		categoryRepository as never,
		clientRepository as never,
		transactionRepository as never,
		statementRepository as never,
		receiptRepository as never,
		sources as never,
		auditService as never,
		transactions as never,
		{ update: vi.fn() } as never,
		payables as never,
		{ update: vi.fn() } as never,
		{ update: vi.fn() } as never,
	);
	return {
		service,
		records,
		edits,
		transactions,
		payables,
		auditService,
		adapter,
		sources,
		statement,
		receipts,
		statementRepository,
		receiptRepository,
	};
};

const apply = (s: ReturnType<typeof setup>, changes: Record<string, unknown>, table = TABLE) =>
	s.service.apply({ userId: USER, workspaceId: WS, table, sourceKey: TX, changes });

describe("SourceWriteBackService.apply", () => {
	it("writes the change and returns every canonical value of the record", async () => {
		const s = setup();
		const result = await apply(s, { type: "income" });
		expect(result.error).toBeNull();
		// Flipping the type flips the sign of the amount too.
		expect(result.values).toMatchObject({ type: "income", amount: 650 });
		expect(s.records[TX]).toMatchObject({ type: "income", amount: 650 });
	});

	it("reads the record by id only, never through the table's filters", async () => {
		const s = setup();
		await apply(s, { currency: "USD" });
		for (const call of s.adapter.fetchRows.mock.calls) {
			expect(call).toEqual([WS, { ids: [TX] }]);
		}
	});

	it("refuses a read-only field before checking anything or writing", async () => {
		const s = setup();
		await expect(apply(s, { currency: "USD", statement: "b.csv" })).rejects.toBeInstanceOf(
			BadRequestException,
		);
		expect(s.transactions.update).not.toHaveBeenCalled();
		expect(s.edits.rows).toHaveLength(0);
	});

	it("refuses a table that is not filled from app data", async () => {
		const s = setup();
		await expect(apply(s, { currency: "USD" }, { id: "t", sourceBinding: null })).rejects.toThrow(
			BadRequestException,
		);
	});

	it.each([
		[WorkspaceRole.VIEWER],
		[WorkspaceRole.ACCOUNTANT],
	])("forbids a %s, as the record's own endpoint does", async role => {
		const s = setup({ role });
		await expect(apply(s, { currency: "USD" })).rejects.toBeInstanceOf(ForbiddenException);
		expect(s.transactions.update).not.toHaveBeenCalled();
	});

	it("forbids a plain member without the statements toggle", async () => {
		const s = setup({ role: WorkspaceRole.MEMBER });
		await expect(apply(s, { currency: "USD" })).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("forbids someone who is not a member at all", async () => {
		const s = setup({ role: null });
		await expect(apply(s, { currency: "USD" })).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("lets a global admin through, as the guard does", async () => {
		const s = setup({ role: null, globalAdmin: true });
		await expect(apply(s, { currency: "USD" })).resolves.toMatchObject({ error: null });
	});

	it("does not write or journal a value the record already has", async () => {
		const s = setup();
		await apply(s, { currency: "EUR" });
		expect(s.transactions.update).not.toHaveBeenCalled();
		expect(s.edits.rows).toHaveLength(0);
	});

	it("journals the record's writable fields once and what each edit left", async () => {
		const s = setup();
		await apply(s, { category: "Travel" });
		await apply(s, { currency: "USD" });
		await apply(s, { category: "" });
		expect(s.edits.rows).toHaveLength(1);
		expect(s.edits.rows[0]).toMatchObject({
			tableId: TABLE.id,
			workspaceId: WS,
			sourceKind: "transactions",
			sourceKey: TX,
			originalValues: { amount: -650, type: "expense", category: "Rent", currency: "EUR" },
			writtenValues: { amount: -650, type: "expense", category: "", currency: "USD" },
		});
	});

	it("keeps read-only fields out of the snapshot", async () => {
		const s = setup();
		await apply(s, { currency: "USD" });
		expect(s.edits.rows[0].originalValues).not.toHaveProperty("statement");
		expect(s.edits.rows[0].writtenValues).not.toHaveProperty("statement");
	});

	it("records the coupled field a write changed too", async () => {
		const s = setup();
		await apply(s, { amount: 700 });
		expect(s.edits.rows[0].writtenValues).toMatchObject({ amount: 700, type: "income" });
	});

	it("drops the journal entry when an edit puts the original back", async () => {
		const s = setup();
		await apply(s, { currency: "USD" });
		expect(s.edits.rows).toHaveLength(1);
		await apply(s, { currency: "EUR" });
		expect(s.edits.rows).toHaveLength(0);
	});

	it("matches the category with the record's own type first", async () => {
		const s = setup();
		await apply(s, { category: "travel" });
		expect(s.transactions.update.mock.calls[0][3]).toEqual({ categoryId: "cat-travel" });
	});

	it("never picks a disabled category", async () => {
		const s = setup();
		const result = await apply(s, { category: "Old" });
		expect(s.transactions.update).not.toHaveBeenCalled();
		expect((result.error as BadRequestException).getResponse()).toMatchObject({
			code: "CATEGORY_NOT_FOUND",
		});
	});

	it("on the app's refusal removes the journal row this call made and reports the error", async () => {
		const s = setup();
		const refusal = new BadRequestException({ code: "TAX_LOCKED" });
		s.transactions.update.mockRejectedValueOnce(refusal);
		const result = await apply(s, { currency: "USD" });
		expect(result.error).toBe(refusal);
		expect(s.edits.rows).toHaveLength(0);
		expect(result.values).toMatchObject({ currency: "EUR" });
	});

	it("on a refusal keeps an older journal row and its original", async () => {
		const s = setup();
		await apply(s, { currency: "USD" });
		s.transactions.update.mockRejectedValueOnce(new BadRequestException({ code: "TAX_LOCKED" }));
		await apply(s, { currency: "GBP" });
		expect(s.edits.rows).toHaveLength(1);
		expect(s.edits.rows[0].originalValues.currency).toBe("EUR");
		expect(s.edits.rows[0].writtenValues.currency).toBe("USD");
	});

	it("stops at the first refusal and reports the values as the app now has them", async () => {
		const s = setup();
		s.transactions.update
			.mockImplementationOnce(async (id: string, _w: string, _u: string, dto: { currency?: string }) => {
				s.records[id].currency = dto.currency;
				return s.records[id];
			})
			.mockRejectedValueOnce(new BadRequestException({ code: "TAX_LOCKED" }));
		const result = await apply(s, { currency: "USD", category: "Travel" });
		expect(result.error).toBeInstanceOf(BadRequestException);
		expect(result.values).toMatchObject({ currency: "USD", category: "Rent" });
	});

	it("fails clearly when the record behind the row is gone", async () => {
		const s = setup();
		delete s.records[TX];
		await expect(apply(s, { currency: "USD" })).rejects.toThrow(BadRequestException);
	});

	it("writes no audit of its own for records whose service audits", async () => {
		const s = setup();
		await apply(s, { currency: "USD" });
		expect(s.auditService.createEvent).not.toHaveBeenCalled();
	});
});

describe("SourceWriteBackService scanned receipts", () => {
	it("moves the document and its receipt to the transaction's new category", async () => {
		const s = setup();
		s.statement.parsingDetails = { detectedBy: "receipt-scan" };
		s.receipts.push({ id: "rec-1", parsedData: { total: 12, categoryId: "cat-rent" } });
		await apply(s, { category: "Travel" });
		expect(s.statementRepository.update).toHaveBeenCalledWith(
			{ id: "stmt-1", workspaceId: WS },
			{ categoryId: "cat-travel" },
		);
		expect(s.receipts[0].parsedData).toEqual({
			total: 12,
			category: "Travel",
			categoryId: "cat-travel",
			categorySource: "manual",
			categoryReason: null,
		});
		expect(s.receiptRepository.save).toHaveBeenCalledWith(s.receipts);
	});

	it("clears the document's category with the transaction's", async () => {
		const s = setup();
		s.statement.parsingDetails = { detectedBy: "receipt-scan" };
		await apply(s, { category: "" });
		expect(s.statementRepository.update).toHaveBeenCalledWith(
			{ id: "stmt-1", workspaceId: WS },
			{ categoryId: null },
		);
	});

	it("follows again when a restore puts the category back", async () => {
		const s = setup();
		s.statement.parsingDetails = { detectedBy: "receipt-scan" };
		await apply(s, { category: "Travel" });
		s.statementRepository.update.mockClear();
		await s.service.revertTable({ userId: USER, workspaceId: WS, table: TABLE });
		expect(s.statementRepository.update).toHaveBeenCalledWith(
			{ id: "stmt-1", workspaceId: WS },
			{ categoryId: "cat-rent" },
		);
	});

	it("leaves a bank statement's own category alone", async () => {
		const s = setup();
		await apply(s, { category: "Travel" });
		expect(s.statementRepository.update).not.toHaveBeenCalled();
		expect(s.receiptRepository.find).not.toHaveBeenCalled();
	});
});

describe("SourceWriteBackService payables", () => {
	const PAYABLE_TABLE = { id: "table-p", sourceBinding: { kind: "payables" } };

	it("audits the change itself, since payables audit only in their controller", async () => {
		const s = setup();
		const payable = { status: "to_pay", vendor: "WeWork", paidAmount: 0 };
		s.sources.get.mockReturnValue({
			fetchRows: vi.fn(async () => [{ sourceKey: TX, values: { ...payable } }]),
		});
		s.payables.update.mockImplementation(async (_i: string, _w: string, _u: string, dto: { vendor: string }) => {
			payable.vendor = dto.vendor;
		});
		await apply(s, { vendor: "Regus" }, PAYABLE_TABLE);
		expect(s.auditService.createEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				entityType: EntityType.PAYABLE,
				entityId: TX,
				diff: { before: { vendor: "WeWork" }, after: { vendor: "Regus" } },
				meta: expect.objectContaining({ via: "custom_table", tableId: "table-p" }),
			}),
		);
	});

	it("journals the payment it recorded, so a restore can remove it", async () => {
		const s = setup();
		const payable = { status: "to_pay", paidAmount: 0 };
		s.sources.get.mockReturnValue({
			fetchRows: vi.fn(async () => [{ sourceKey: TX, values: { status: payable.status } }]),
		});
		s.payables.findOne.mockImplementation(async () => payable);
		s.payables.listPayments.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "pay-9" }]);
		s.payables.markAsPaid.mockImplementation(async () => {
			payable.status = "paid";
		});
		await apply(s, { status: "paid" }, PAYABLE_TABLE);
		expect(s.edits.rows[0]).toMatchObject({
			originalValues: { status: "to_pay" },
			writtenValues: { status: "paid" },
			meta: { paymentId: "pay-9" },
		});
	});
});

describe("SourceWriteBackService.revertTable", () => {
	const revert = (s: ReturnType<typeof setup>) =>
		s.service.revertTable({ userId: USER, workspaceId: WS, table: TABLE });

	it("puts every field the table changed back and empties the journal", async () => {
		const s = setup();
		await apply(s, { category: "Travel" });
		await apply(s, { currency: "USD" });
		s.transactions.update.mockClear();
		const report = await revert(s);
		expect(report).toEqual({ reverted: 2, skippedChanged: 0, failed: [] });
		expect(s.records[TX]).toMatchObject({ category: "Rent", currency: "EUR" });
		expect(s.edits.rows).toHaveLength(0);
	});

	it("decides from one read, so reverting the amount does not make the type look changed", async () => {
		const s = setup();
		await apply(s, { type: "income" });
		await apply(s, { amount: 700 });
		const report = await revert(s);
		expect(report).toEqual({ reverted: 2, skippedChanged: 0, failed: [] });
		expect(s.records[TX]).toMatchObject({ amount: -650, type: "expense" });
	});

	it("restores the record the table found, not a state in between (type, then amount)", async () => {
		const s = setup();
		await apply(s, { type: "income" }); // -650 expense → 650 income
		await apply(s, { amount: -700 }); // → 700 expense: the type is back, the amount is not
		const report = await revert(s);
		expect(report).toEqual({ reverted: 1, skippedChanged: 0, failed: [] });
		expect(s.records[TX]).toMatchObject({ amount: -650, type: "expense" });
	});

	it("leaves a field alone that was changed in the app since", async () => {
		const s = setup();
		await apply(s, { currency: "USD" });
		s.records[TX].currency = "GBP"; // someone edited the transaction on its own page
		s.transactions.update.mockClear();
		const report = await revert(s);
		expect(report).toEqual({ reverted: 0, skippedChanged: 1, failed: [] });
		expect(s.records[TX].currency).toBe("GBP");
		expect(s.transactions.update).not.toHaveBeenCalled();
		expect(s.edits.rows).toHaveLength(0);
	});

	it("reports a refusal and keeps the entry for a later retry", async () => {
		const s = setup();
		await apply(s, { currency: "USD" });
		s.transactions.update.mockRejectedValueOnce(
			new BadRequestException({ code: "TRANSACTION_TAX_LOCKED" }),
		);
		const report = await revert(s);
		expect(report).toEqual({
			reverted: 0,
			skippedChanged: 0,
			failed: [{ sourceKey: TX, field: "currency", code: "TRANSACTION_TAX_LOCKED" }],
		});
		expect(s.edits.rows).toHaveLength(1);
		// The retry succeeds once the app allows it.
		await expect(revert(s)).resolves.toEqual({ reverted: 1, skippedChanged: 0, failed: [] });
		expect(s.records[TX].currency).toBe("EUR");
	});

	it("after a partial refusal retries only the refused field", async () => {
		const s = setup();
		await apply(s, { category: "Travel" });
		await apply(s, { currency: "USD" });
		// The category goes back; the currency is refused this time.
		s.transactions.update.mockImplementation(
			async (id: string, _w: string, _u: string, dto: Record<string, unknown>) => {
				if (dto.currency) {
					throw new BadRequestException({ code: "TRANSACTION_TAX_LOCKED" });
				}
				if ("categoryId" in dto) {
					s.records[id].category = "Rent";
				}
				return s.records[id];
			},
		);
		expect(await revert(s)).toEqual({
			reverted: 1,
			skippedChanged: 0,
			failed: [{ sourceKey: TX, field: "currency", code: "TRANSACTION_TAX_LOCKED" }],
		});
		s.transactions.update.mockImplementation(
			async (id: string, _w: string, _u: string, dto: Record<string, unknown>) => {
				if (dto.currency) {
					s.records[id].currency = dto.currency;
				}
				return s.records[id];
			},
		);
		// The category is settled: the retry neither touches it nor calls it changed elsewhere.
		expect(await revert(s)).toEqual({ reverted: 1, skippedChanged: 0, failed: [] });
		expect(s.records[TX]).toMatchObject({ category: "Rent", currency: "EUR" });
		expect(s.edits.rows).toHaveLength(0);
	});

	it("skips records that no longer exist and forgets them", async () => {
		const s = setup();
		await apply(s, { currency: "USD" });
		delete s.records[TX];
		const report = await revert(s);
		expect(report).toEqual({ reverted: 0, skippedChanged: 1, failed: [] });
		expect(s.edits.rows).toHaveLength(0);
	});

	it("is a no-op the second time", async () => {
		const s = setup();
		await apply(s, { currency: "USD" });
		await revert(s);
		s.transactions.update.mockClear();
		await expect(revert(s)).resolves.toEqual({ reverted: 0, skippedChanged: 0, failed: [] });
		expect(s.transactions.update).not.toHaveBeenCalled();
	});

	it("checks the permission before reverting anything", async () => {
		const s = setup();
		await apply(s, { currency: "USD" });
		const viewer = setup({ role: WorkspaceRole.VIEWER });
		viewer.edits.rows.push(...s.edits.rows);
		await expect(
			viewer.service.revertTable({ userId: USER, workspaceId: WS, table: TABLE }),
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(viewer.transactions.update).not.toHaveBeenCalled();
	});

	it("only touches this table's journal", async () => {
		const s = setup();
		await apply(s, { currency: "USD" });
		s.edits.rows[0].tableId = "another-table";
		await expect(revert(s)).resolves.toEqual({ reverted: 0, skippedChanged: 0, failed: [] });
		expect(s.edits.rows).toHaveLength(1);
	});
});
