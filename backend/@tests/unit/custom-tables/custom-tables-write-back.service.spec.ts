import { BadRequestException } from "@nestjs/common";
import { EntityType } from "../../../src/entities/audit-event.entity";
import { CustomTableColumnType } from "../../../src/entities/custom-table-column.entity";
import { CustomTablesService } from "../../../src/modules/custom-tables/custom-tables.service";
import { workspaceCurrencyStub } from "../../helpers/workspace-currency-stub";

const TABLE_ID = "11111111-1111-4111-8111-111111111111";
const ROW_ID = "22222222-2222-4222-8222-222222222222";
const WS = "ws-1";
const USER = "user-1";

const appColumn = (key: string, field: string, type = CustomTableColumnType.TEXT) => ({
	key,
	title: field,
	type,
	isRequired: false,
	isUnique: false,
	config: { source: { kind: "app_field", field } },
});

const COLUMNS = [
	appColumn("c_amount", "amount", CustomTableColumnType.CURRENCY),
	appColumn("c_type", "type", CustomTableColumnType.SELECT),
	appColumn("c_category", "category"),
	appColumn("c_statement", "statement"),
	{ key: "c_note", title: "Note", type: CustomTableColumnType.TEXT, isRequired: false, isUnique: false, config: null },
];

const setup = (options: {
	sourceBinding?: { kind: string } | null;
	sourceKey?: string | null;
	writeBack?: { values: Record<string, unknown>; error: unknown | null } | Error;
	withWriteBack?: boolean;
} = {}) => {
	const table = {
		id: TABLE_ID,
		workspaceId: WS,
		sourceBinding: options.sourceBinding === undefined ? { kind: "transactions", filters: {}, syncedAt: null } : options.sourceBinding,
	};
	const row = {
		id: ROW_ID,
		tableId: TABLE_ID,
		rowNumber: 1,
		sourceKey: options.sourceKey === undefined ? "tx-1" : options.sourceKey,
		data: { c_amount: -650, c_type: "expense", c_category: "Rent", c_statement: "a.csv", c_note: "" },
		styles: null,
	};
	const qb = { leftJoinAndSelect: vi.fn(), where: vi.fn(), andWhere: vi.fn(), getOne: vi.fn().mockResolvedValue(table) };
	qb.leftJoinAndSelect.mockReturnValue(qb);
	qb.where.mockReturnValue(qb);
	qb.andWhere.mockReturnValue(qb);
	const customTableRepository = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
	const customTableColumnRepository = { find: vi.fn().mockResolvedValue(COLUMNS) };
	const customTableRowRepository = {
		findOne: vi.fn().mockResolvedValue(row),
		save: vi.fn(async (value: unknown) => value),
	};
	const workspaceMemberRepository = { findOne: vi.fn().mockResolvedValue(null) };
	const auditService = { createEvent: vi.fn().mockResolvedValue(undefined) };
	const sourceWriteBack = {
		apply: vi.fn(async () => {
			if (options.writeBack instanceof Error) {
				throw options.writeBack;
			}
			return options.writeBack ?? { values: {}, error: null };
		}),
	};
	const service = new CustomTablesService(
		customTableRepository as never,
		{} as never,
		customTableColumnRepository as never,
		customTableRowRepository as never,
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
		undefined,
		undefined,
		workspaceCurrencyStub("EUR") as never,
		undefined,
		options.withWriteBack === false ? undefined : (sourceWriteBack as never),
	);
	return { service, row, sourceWriteBack, customTableRowRepository, auditService };
};

const update = (s: ReturnType<typeof setup>, data: Record<string, unknown>) =>
	s.service.updateRow(USER, WS, TABLE_ID, ROW_ID, { data });

describe("CustomTablesService.updateRow with app write-back", () => {
	it("sends app columns to the record by field, not by column key", async () => {
		const s = setup({ writeBack: { values: { category: "Travel" }, error: null } });
		await update(s, { c_category: "Travel" });
		expect(s.sourceWriteBack.apply).toHaveBeenCalledWith({
			userId: USER,
			workspaceId: WS,
			table: expect.objectContaining({ id: TABLE_ID }),
			sourceKey: "tx-1",
			changes: { category: "Travel" },
		});
	});

	it("saves the record's canonical values into every app column of the row", async () => {
		const s = setup({
			writeBack: { values: { amount: 650, type: "income", category: "Rent", statement: "a.csv" }, error: null },
		});
		const saved = await update(s, { c_type: "income" });
		expect(saved.data).toMatchObject({ c_amount: 650, c_type: "income", c_category: "Rent" });
	});

	it("leaves a plain column out of the write-back and saves it as before", async () => {
		const s = setup();
		const saved = await update(s, { c_note: "checked" });
		expect(s.sourceWriteBack.apply).not.toHaveBeenCalled();
		expect(saved.data).toMatchObject({ c_note: "checked" });
	});

	it("saves both an app and a plain cell in one patch", async () => {
		const s = setup({ writeBack: { values: { category: "Travel" }, error: null } });
		const saved = await update(s, { c_category: "Travel", c_note: "x" });
		expect(s.sourceWriteBack.apply.mock.calls[0][0].changes).toEqual({ category: "Travel" });
		expect(saved.data).toMatchObject({ c_category: "Travel", c_note: "x" });
	});

	it("never writes back a hand-added row of a source table", async () => {
		const s = setup({ sourceKey: null });
		const saved = await update(s, { c_category: "Travel" });
		expect(s.sourceWriteBack.apply).not.toHaveBeenCalled();
		expect(saved.data).toMatchObject({ c_category: "Travel" });
	});

	it("never writes back a table that is not filled from app data", async () => {
		const s = setup({ sourceBinding: null });
		await update(s, { c_category: "Travel" });
		expect(s.sourceWriteBack.apply).not.toHaveBeenCalled();
	});

	it("on the app's refusal saves only what the app now holds, then fails", async () => {
		const refusal = new BadRequestException({ code: "TAX_LOCKED" });
		const s = setup({
			writeBack: { values: { amount: -650, type: "expense", category: "Rent" }, error: refusal },
		});
		await expect(update(s, { c_category: "Travel", c_note: "lost" })).rejects.toBe(refusal);
		const saved = s.customTableRowRepository.save.mock.calls[0][0] as { data: Record<string, unknown> };
		expect(saved.data).toMatchObject({ c_category: "Rent", c_note: "" });
		expect(s.auditService.createEvent).not.toHaveBeenCalled();
	});

	it("saves nothing when the write-back refuses before writing (read-only, forbidden)", async () => {
		const s = setup({ writeBack: new BadRequestException({ code: "SOURCE_FIELD_READ_ONLY" }) });
		await expect(update(s, { c_statement: "b.csv" })).rejects.toBeInstanceOf(BadRequestException);
		expect(s.customTableRowRepository.save).not.toHaveBeenCalled();
	});

	it("audits app cells as not undoable and plain cells as before", async () => {
		const s = setup({ writeBack: { values: { category: "Travel" }, error: null } });
		await update(s, { c_category: "Travel", c_note: "x" });
		const events = s.auditService.createEvent.mock.calls.map(([event]) => event);
		const byColumn = Object.fromEntries(
			events.map(event => [event.meta.cell.column, event]),
		);
		expect(byColumn.c_category).toMatchObject({ entityType: EntityType.TABLE_CELL, isUndoable: false });
		expect(byColumn.c_note.isUndoable).toBeUndefined();
	});

	it("audits only cells whose value changed", async () => {
		const s = setup({
			writeBack: { values: { amount: -650, type: "expense", category: "Travel", statement: "a.csv" }, error: null },
		});
		await update(s, { c_category: "Travel" });
		const columns = s.auditService.createEvent.mock.calls.map(([event]) => event.meta.cell.column);
		expect(columns).toEqual(["c_category"]);
	});

	it("keeps the old behaviour when no write-back service is wired in", async () => {
		const s = setup({ withWriteBack: false });
		const saved = await update(s, { c_category: "Travel" });
		expect(saved.data).toMatchObject({ c_category: "Travel" });
	});
});
