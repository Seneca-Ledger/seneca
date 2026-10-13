import { BadRequestException } from "@nestjs/common";
import { AuditAction, EntityType } from "../../../src/entities/audit-event.entity";
import { CustomTable } from "../../../src/entities/custom-table.entity";
import { CustomTableCellStyle } from "../../../src/entities/custom-table-cell-style.entity";
import { CustomTableColumn, CustomTableColumnType } from "../../../src/entities/custom-table-column.entity";
import { CustomTableColumnStyle } from "../../../src/entities/custom-table-column-style.entity";
import { CustomTableRow } from "../../../src/entities/custom-table-row.entity";
import { CustomTablesService } from "../../../src/modules/custom-tables/custom-tables.service";
import { workspaceCurrencyStub } from "../../helpers/workspace-currency-stub";

const TABLE_ID = "11111111-1111-4111-8111-111111111111";
const WS = "ws-1";
const USER = "user-1";

const ADAPTER_COLUMNS = [
	{ field: "date", title: "Date", type: CustomTableColumnType.DATE },
	{ field: "amount", title: "Amount", type: CustomTableColumnType.CURRENCY, money: true },
	{
		field: "type",
		title: "Type",
		type: CustomTableColumnType.SELECT,
		config: { options: [{ value: "income" }, { value: "expense" }] },
	},
];

/** A chainable query builder that records its where-clauses. */
const builder = (log: Array<{ op: string; args: unknown[] }>) => {
	const qb: Record<string, jest.Mock> = {};
	for (const method of ["delete", "update", "set", "from", "where", "andWhere"]) {
		qb[method] = jest.fn((...args: unknown[]) => {
			log.push({ op: method, args });
			return qb;
		});
	}
	qb.execute = jest.fn(async () => {
		log.push({ op: "execute", args: [] });
		return { affected: 1 };
	});
	return qb;
};

const setup = (options: { binding?: unknown; columns?: unknown[]; sourceKeys?: string[] } = {}) => {
	const order: string[] = [];
	const table = {
		id: TABLE_ID,
		workspaceId: WS,
		sourceBinding:
			options.binding === undefined
				? { kind: "transactions", filters: { type: "expense" }, syncedAt: null }
				: options.binding,
	};
	const columns =
		options.columns ??
		[
			{ id: "col-amount", key: "c_amount", title: "Betrag", type: CustomTableColumnType.TEXT, position: 4, isRequired: true, isUnique: false, config: { source: { kind: "app_field", field: "amount" }, currency: "EUR", precision: 0 } },
			{ id: "col-type", key: "c_type", title: "Type", type: CustomTableColumnType.TEXT, position: 0, isRequired: false, isUnique: true, config: { source: { kind: "app_field", field: "type" } } },
			{ id: "col-note", key: "c_note", title: "Note", type: CustomTableColumnType.TEXT, position: 1, isRequired: false, isUnique: false, config: null },
			{ id: "col-formula", key: "c_f", title: "F", type: CustomTableColumnType.FORMULA, position: 2, isRequired: false, isUnique: false, config: { expression: "[a]" } },
		];
	const queries: Array<{ op: string; args: unknown[] }> = [];
	const columnRepo = {
		find: jest.fn().mockResolvedValue(columns),
		delete: jest.fn(async () => order.push("deleteColumns")),
		create: jest.fn((value: Record<string, unknown>) => ({ ...value })),
		save: jest.fn(async (value: unknown) => value),
	};
	const rowRepo = { createQueryBuilder: jest.fn(() => builder(queries)) };
	const columnStyleRepo = { delete: jest.fn() };
	const tableRepoInTx = { update: jest.fn() };
	const manager = {
		getRepository: jest.fn((entity: unknown) => {
			if (entity === CustomTableColumn) return columnRepo;
			if (entity === CustomTableRow) return rowRepo;
			if (entity === CustomTableColumnStyle) return columnStyleRepo;
			if (entity === CustomTable) return tableRepoInTx;
			throw new Error("unexpected repository");
		}),
		createQueryBuilder: jest.fn(() => builder(queries)),
	};
	const qb = { leftJoinAndSelect: jest.fn(), where: jest.fn(), andWhere: jest.fn(), getOne: jest.fn().mockResolvedValue(table) };
	qb.leftJoinAndSelect.mockReturnValue(qb);
	qb.where.mockReturnValue(qb);
	qb.andWhere.mockReturnValue(qb);
	const customTableRepository = {
		createQueryBuilder: jest.fn().mockReturnValue(qb),
		manager: {
			transaction: jest.fn(async (work: (m: typeof manager) => Promise<unknown>) => {
				order.push("transaction");
				return work(manager);
			}),
		},
	};
	const sourceRows = (options.sourceKeys ?? ["tx-1", "tx-2"]).map(key => ({
		sourceKey: key,
		values: { date: "2024-09-01", amount: -1, type: "expense" },
	}));
	const adapter = { kind: "transactions", columns: ADAPTER_COLUMNS, fetchRows: jest.fn(async () => sourceRows) };
	const sources = { get: jest.fn().mockReturnValue(adapter) };
	const sourceWriteBack = {
		revertTable: jest.fn(async () => {
			order.push("revert");
			return { reverted: 3, skippedChanged: 1, failed: [{ sourceKey: "tx-9", field: "amount", code: "TAX_LOCKED" }] };
		}),
	};
	const auditService = { createEvent: jest.fn().mockResolvedValue(undefined) };
	const workspaceMemberRepository = { findOne: jest.fn().mockResolvedValue(null) };
	const service = new CustomTablesService(
		customTableRepository as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		workspaceMemberRepository as never,
		auditService as never,
		undefined,
		sources as never,
		undefined,
		workspaceCurrencyStub("EUR") as never,
		undefined,
		sourceWriteBack as never,
	);
	// The re-fill is covered by the refresh tests; here it only has to be reached with the right input.
	const applySourceRows = jest
		.spyOn(service as unknown as { applySourceRows: () => Promise<unknown> }, "applySourceRows")
		.mockImplementation(async () => {
			order.push("refill");
			return { inserted: 0, updated: 2, unchanged: 0, total: 2, syncedAt: "now" };
		});
	return {
		service,
		order,
		columnRepo,
		columnStyleRepo,
		tableRepoInTx,
		queries,
		sourceWriteBack,
		auditService,
		applySourceRows,
		adapter,
	};
};

const restore = (s: ReturnType<typeof setup>) => s.service.restoreDefault(USER, WS, TABLE_ID);

describe("CustomTablesService.restoreDefault", () => {
	it("refuses a table that is not filled from app data, touching nothing", async () => {
		const s = setup({ binding: null });
		await expect(restore(s)).rejects.toBeInstanceOf(BadRequestException);
		expect(s.sourceWriteBack.revertTable).not.toHaveBeenCalled();
		expect(s.order).toEqual([]);
	});

	it("undoes the app changes first, then resets the table, then refills it", async () => {
		const s = setup();
		await restore(s);
		expect(s.order).toEqual(["revert", "transaction", "deleteColumns", "refill"]);
		expect(s.sourceWriteBack.revertTable).toHaveBeenCalledWith({
			userId: USER,
			workspaceId: WS,
			table: expect.objectContaining({ id: TABLE_ID }),
		});
	});

	it("reads the source with the table's own filters", async () => {
		const s = setup();
		await restore(s);
		expect(s.adapter.fetchRows).toHaveBeenCalledWith(WS, { type: "expense" });
	});

	it("deletes hand-added and orphaned columns and keeps the source ones", async () => {
		const s = setup();
		await restore(s);
		expect(s.columnRepo.delete).toHaveBeenCalledWith(["col-note", "col-formula"]);
	});

	it("puts source columns back to the source's type, options and order, keeping titles and keys", async () => {
		const s = setup();
		await restore(s);
		const saved = s.columnRepo.save.mock.calls[0][0] as Array<Record<string, unknown>>;
		expect(saved.map(column => (column.config as { source: { field: string } }).source.field)).toEqual([
			"date",
			"amount",
			"type",
		]);
		const [date, amount, type] = saved;
		expect(amount).toMatchObject({
			id: "col-amount",
			key: "c_amount",
			title: "Betrag",
			type: CustomTableColumnType.CURRENCY,
			position: 1,
			isRequired: false,
			isUnique: false,
			config: { precision: 2, currency: "EUR", source: { kind: "app_field", field: "amount" } },
		});
		expect(type).toMatchObject({
			key: "c_type",
			type: CustomTableColumnType.SELECT,
			position: 2,
			isUnique: false,
			config: { options: [{ value: "income" }, { value: "expense" }], source: { kind: "app_field", field: "type" } },
		});
		// A source column the user had deleted comes back under its default title.
		expect(date).toMatchObject({ title: "Date", type: CustomTableColumnType.DATE, position: 0 });
		expect(typeof date.key).toBe("string");
	});

	it("deletes hand-typed rows and rows of records that are gone", async () => {
		const s = setup({ sourceKeys: ["tx-1", "tx-2"] });
		await restore(s);
		const andWheres = s.queries.filter(q => q.op === "andWhere").map(q => q.args);
		expect(andWheres).toContainEqual([
			"(source_key IS NULL OR source_key NOT IN (:...liveKeys))",
			{ liveKeys: ["tx-1", "tx-2"] },
		]);
	});

	it("deletes every row when the source has no records left", async () => {
		const s = setup({ sourceKeys: [] });
		await restore(s);
		const deleteIndex = s.queries.findIndex(q => q.op === "delete");
		const executeIndex = s.queries.findIndex((q, i) => i > deleteIndex && q.op === "execute");
		const between = s.queries.slice(deleteIndex, executeIndex);
		expect(between.some(q => q.op === "andWhere")).toBe(false);
		expect(between).toContainEqual({ op: "where", args: ["table_id = :tableId", { tableId: TABLE_ID }] });
	});

	it("empties the remaining rows, styles and view settings before the refill", async () => {
		const s = setup();
		await restore(s);
		expect(s.queries).toContainEqual({ op: "set", args: [{ data: {}, styles: {}, computed: {} }] });
		expect(s.columnStyleRepo.delete).toHaveBeenCalledWith({ tableId: TABLE_ID });
		expect(s.queries).toContainEqual({ op: "from", args: [CustomTableCellStyle] });
		expect(s.tableRepoInTx.update).toHaveBeenCalledWith({ id: TABLE_ID }, { viewSettings: {} });
	});

	it("refills from the source with the rebuilt columns", async () => {
		const s = setup();
		await restore(s);
		const params = s.applySourceRows.mock.calls[0][0] as { columns: unknown[]; sourceRows: unknown[] };
		expect(params.columns).toHaveLength(3);
		expect(params.sourceRows).toHaveLength(2);
	});

	it("answers with what was undone, skipped and refused, and the row count", async () => {
		const s = setup();
		await expect(restore(s)).resolves.toEqual({
			tableId: TABLE_ID,
			reverted: 3,
			skippedChanged: 1,
			failed: [{ sourceKey: "tx-9", field: "amount", code: "TAX_LOCKED" }],
			rows: 2,
		});
	});

	it("records the restore in the audit trail, not undoable", async () => {
		const s = setup();
		await restore(s);
		expect(s.auditService.createEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				entityType: EntityType.CUSTOM_TABLE,
				entityId: TABLE_ID,
				action: AuditAction.ROLLBACK,
				isUndoable: false,
				meta: expect.objectContaining({ restoredDefault: true, reverted: 3, skippedChanged: 1, failed: 1, rows: 2 }),
			}),
		);
	});
});
