import { BadRequestException } from "@nestjs/common";
import { CustomTableSource } from "../../../src/entities/custom-table.entity";
import { CustomTableColumnType } from "../../../src/entities/custom-table-column.entity";
import { CustomTablesService } from "../../../src/modules/custom-tables/custom-tables.service";
import type {
	SourceAdapter,
	SourceRow,
} from "../../../src/modules/custom-tables/sources/source.types";

const TABLE_ID = "11111111-1111-4111-8111-111111111111";
const COLUMN_ID = "22222222-2222-4222-8222-222222222222";

const createRepositoryMock = () => ({
	findOne: jest.fn(),
	find: jest.fn(),
	save: jest.fn(),
	create: jest.fn((value?: unknown) => value),
	delete: jest.fn(),
	update: jest.fn(),
	createQueryBuilder: jest.fn(),
});

/** One chainable builder for every query the service issues. */
const createQueryBuilderMock = (result: {
	getOne?: unknown;
	getMany?: unknown;
	getRawOne?: unknown;
}) => {
	const qb: Record<string, jest.Mock> = {};
	for (const method of [
		"leftJoinAndSelect",
		"leftJoin",
		"where",
		"andWhere",
		"orderBy",
		"addOrderBy",
		"select",
		"update",
		"set",
		"setParameter",
	]) {
		qb[method] = jest.fn().mockReturnValue(qb);
	}
	qb.getOne = jest.fn().mockResolvedValue(result.getOne ?? null);
	qb.getMany = jest.fn().mockResolvedValue(result.getMany ?? []);
	qb.getRawOne = jest.fn().mockResolvedValue(result.getRawOne ?? { max: null });
	qb.execute = jest.fn().mockResolvedValue({ affected: 1 });
	return qb;
};

const adapterMock = (rows: SourceRow[]): SourceAdapter => ({
	kind: "transactions",
	columns: [
		{ field: "date", title: "Date", type: CustomTableColumnType.DATE },
		{
			field: "amount",
			title: "Amount",
			type: CustomTableColumnType.CURRENCY,
			money: true,
		},
		{ field: "currency", title: "Currency", type: CustomTableColumnType.TEXT },
	],
	fetchRows: jest.fn().mockResolvedValue(rows),
});

function build(adapter: SourceAdapter) {
	const repos = {
		customTable: createRepositoryMock(),
		category: createRepositoryMock(),
		column: createRepositoryMock(),
		row: createRepositoryMock(),
		columnStyle: createRepositoryMock(),
		cellStyle: createRepositoryMock(),
		dataEntry: createRepositoryMock(),
		dataEntryCustomField: createRepositoryMock(),
		statement: createRepositoryMock(),
		transaction: createRepositoryMock(),
		user: createRepositoryMock(),
		workspaceMember: createRepositoryMock(),
	};
	const auditService = {
		createEvent: jest.fn().mockResolvedValue(undefined),
		createBatchEvents: jest.fn().mockResolvedValue(undefined),
	};
	const manager = {
		save: jest.fn().mockImplementation(async (_entity, rows) => rows),
		update: jest.fn().mockResolvedValue(undefined),
		createQueryBuilder: jest.fn(),
	};
	const updateQb = createQueryBuilderMock({});
	manager.createQueryBuilder.mockReturnValue(updateQb);
	(repos.customTable as Record<string, unknown>).manager = {
		transaction: jest.fn(async (cb: (m: typeof manager) => Promise<void>) =>
			cb(manager),
		),
	};
	repos.workspaceMember.findOne.mockResolvedValue({
		role: "owner",
		permissions: {},
	});
	// getNextRowNumber: MAX(rowNumber) = 2 → next is 3
	repos.row.createQueryBuilder.mockReturnValue(
		createQueryBuilderMock({ getRawOne: { max: "2" } }),
	);
	repos.row.find.mockResolvedValue([]);
	repos.column.save.mockImplementation(async (values) =>
		(values as Array<Record<string, unknown>>).map((v, i) => ({
			...v,
			key: `col_${i}`,
		})),
	);
	const service = new CustomTablesService(
		repos.customTable as never,
		repos.category as never,
		repos.column as never,
		repos.row as never,
		repos.columnStyle as never,
		repos.cellStyle as never,
		repos.dataEntry as never,
		repos.dataEntryCustomField as never,
		repos.statement as never,
		repos.transaction as never,
		repos.user as never,
		repos.workspaceMember as never,
		auditService as never,
		undefined as never,
		{ get: jest.fn().mockReturnValue(adapter) } as never,
	);
	return { service, repos, auditService, manager, updateQb };
}

const sourceRows: SourceRow[] = [
	{
		sourceKey: "tx-1",
		values: { date: "2026-09-01", amount: -500, currency: "EUR" },
	},
	{
		sourceKey: "tx-2",
		values: { date: "2026-09-02", amount: 1200, currency: "EUR" },
	},
];

describe("CustomTablesService.createFromSource", () => {
	it("stores the binding, links columns to source fields and inserts keyed rows", async () => {
		const { service, repos, manager } = build(adapterMock(sourceRows));
		repos.customTable.save.mockImplementation(async (value) => ({
			id: TABLE_ID,
			...(value as object),
		}));

		const result = await service.createFromSource("user-1", "workspace-1", {
			kind: "transactions",
			filters: { dateFrom: "2026-09-01", type: "", categoryIds: [] },
			name: "September",
			currency: "eur",
			columnTitles: { date: "Дата" },
		});

		expect(result).toEqual({
			tableId: TABLE_ID,
			columnsCreated: 3,
			rowsCreated: 2,
		});
		expect(repos.customTable.save).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "September",
				source: CustomTableSource.MANUAL,
				sourceBinding: {
					kind: "transactions",
					filters: { dateFrom: "2026-09-01" },
					syncedAt: null,
				},
			}),
		);
		const columns = repos.column.save.mock.calls[0][0] as Array<
			Record<string, unknown>
		>;
		expect(columns[0]).toEqual(
			expect.objectContaining({
				title: "Дата",
				type: CustomTableColumnType.DATE,
				config: { source: { kind: "app_field", field: "date" } },
			}),
		);
		expect(columns[1].config).toEqual({
			precision: 2,
			currency: "EUR",
			source: { kind: "app_field", field: "amount" },
		});
		expect(columns[2].title).toBe("Currency");

		const inserted = manager.save.mock.calls[0][1] as Array<
			Record<string, unknown>
		>;
		expect(inserted).toEqual([
			expect.objectContaining({
				tableId: TABLE_ID,
				rowNumber: 3,
				sourceKey: "tx-1",
				data: { col_0: "2026-09-01", col_1: -500, col_2: "EUR" },
			}),
			expect.objectContaining({ rowNumber: 4, sourceKey: "tx-2" }),
		]);
		expect(manager.update).toHaveBeenCalledWith(
			expect.anything(),
			{ id: TABLE_ID },
			{
				sourceBinding: expect.objectContaining({
					kind: "transactions",
					syncedAt: expect.any(String),
				}),
			},
		);
	});

	it("refuses to create an empty table", async () => {
		const { service, repos } = build(adapterMock([]));
		await expect(
			service.createFromSource("user-1", "workspace-1", {
				kind: "transactions",
			}),
		).rejects.toMatchObject({
			response: expect.objectContaining({ code: "SOURCE_EMPTY" }),
		});
		expect(repos.customTable.save).not.toHaveBeenCalled();
	});
});

describe("CustomTablesService.refreshFromSource", () => {
	const boundTable = {
		id: TABLE_ID,
		workspaceId: "workspace-1",
		sourceBinding: {
			kind: "transactions",
			filters: { dateFrom: "2026-09-01" },
			syncedAt: null,
		},
		columns: [
			{
				key: "col_date",
				type: "date",
				config: { source: { kind: "app_field", field: "date" } },
			},
			{
				key: "col_amount",
				type: "currency",
				config: {
					currency: "EUR",
					source: { kind: "app_field", field: "amount" },
				},
			},
			{ key: "col_note", type: "text", config: null },
		],
	};

	it("patches only bound cells of known rows, inserts new ones and never deletes", async () => {
		const adapter = adapterMock(sourceRows);
		const { service, repos, manager, updateQb } = build(adapter);
		repos.customTable.createQueryBuilder.mockReturnValue(
			createQueryBuilderMock({ getOne: boundTable }),
		);
		repos.row.find.mockResolvedValue([
			{
				id: "row-1",
				sourceKey: "tx-1",
				data: { col_date: "2026-09-01", col_amount: -450, col_note: "mine" },
			},
		]);

		const result = await service.refreshFromSource(
			"user-1",
			"workspace-1",
			TABLE_ID,
		);

		expect(result).toEqual(
			expect.objectContaining({
				tableId: TABLE_ID,
				inserted: 1,
				updated: 1,
				unchanged: 0,
				total: 2,
			}),
		);
		expect(adapter.fetchRows).toHaveBeenCalledWith("workspace-1", {
			dateFrom: "2026-09-01",
		});
		// update touches only the two bound keys; the user's note is not in the patch
		expect(updateQb.setParameter).toHaveBeenCalledWith(
			"patch",
			JSON.stringify({ col_date: "2026-09-01", col_amount: -500 }),
		);
		expect(updateQb.where).toHaveBeenCalledWith(
			"id = :id AND table_id = :tableId",
			{ id: "row-1", tableId: TABLE_ID },
		);
		const inserted = manager.save.mock.calls[0][1] as Array<
			Record<string, unknown>
		>;
		expect(inserted).toEqual([
			expect.objectContaining({
				rowNumber: 3,
				sourceKey: "tx-2",
				data: { col_date: "2026-09-02", col_amount: 1200 },
			}),
		]);
		expect(repos.row.delete).not.toHaveBeenCalled();
		expect(manager.update).toHaveBeenCalledWith(
			expect.anything(),
			{ id: TABLE_ID },
			{
				sourceBinding: expect.objectContaining({
					filters: { dateFrom: "2026-09-01" },
					syncedAt: expect.any(String),
				}),
			},
		);
	});

	it("counts identical rows as unchanged without issuing an update", async () => {
		const { service, repos, updateQb, manager } = build(
			adapterMock([sourceRows[0]]),
		);
		repos.customTable.createQueryBuilder.mockReturnValue(
			createQueryBuilderMock({ getOne: boundTable }),
		);
		repos.row.find.mockResolvedValue([
			{
				id: "row-1",
				sourceKey: "tx-1",
				data: { col_date: "2026-09-01", col_amount: -500, col_note: "mine" },
			},
		]);

		const result = await service.refreshFromSource(
			"user-1",
			"workspace-1",
			TABLE_ID,
		);

		expect(result).toEqual(
			expect.objectContaining({ inserted: 0, updated: 0, unchanged: 1 }),
		);
		expect(updateQb.execute).not.toHaveBeenCalled();
		expect(manager.save).not.toHaveBeenCalled();
	});

	it("rejects tables without a source binding", async () => {
		const { service, repos } = build(adapterMock(sourceRows));
		repos.customTable.createQueryBuilder.mockReturnValue(
			createQueryBuilderMock({
				getOne: { ...boundTable, sourceBinding: null },
			}),
		);
		await expect(
			service.refreshFromSource("user-1", "workspace-1", TABLE_ID),
		).rejects.toMatchObject({
			response: expect.objectContaining({
				code: "TABLE_NOT_LINKED_TO_SOURCE",
			}),
		});
	});

	it("rejects tables whose source columns were all removed", async () => {
		const { service, repos } = build(adapterMock(sourceRows));
		repos.customTable.createQueryBuilder.mockReturnValue(
			createQueryBuilderMock({
				getOne: {
					...boundTable,
					columns: [{ key: "col_note", type: "text", config: null }],
				},
			}),
		);
		await expect(
			service.refreshFromSource("user-1", "workspace-1", TABLE_ID),
		).rejects.toBeInstanceOf(BadRequestException);
	});
});

describe("CustomTablesService.updateColumn", () => {
	it("keeps the source link when the client sends a config without it", async () => {
		const { service, repos } = build(adapterMock([]));
		repos.customTable.findOne.mockResolvedValue({
			id: TABLE_ID,
			workspaceId: "workspace-1",
		});
		repos.customTable.createQueryBuilder.mockReturnValue(
			createQueryBuilderMock({
				getOne: { id: TABLE_ID, workspaceId: "workspace-1" },
			}),
		);
		repos.column.findOne.mockResolvedValue({
			id: COLUMN_ID,
			tableId: TABLE_ID,
			key: "col_amount",
			title: "Amount",
			type: CustomTableColumnType.CURRENCY,
			config: {
				currency: "EUR",
				precision: 2,
				source: { kind: "app_field", field: "amount" },
			},
		});
		repos.column.save.mockImplementation(async (value) => value);

		const saved = await service.updateColumn(
			"user-1",
			"workspace-1",
			TABLE_ID,
			COLUMN_ID,
			{ title: "Sum", config: { currency: "USD", precision: 0 } },
		);

		expect(saved.title).toBe("Sum");
		expect(saved.config).toEqual({
			currency: "USD",
			precision: 0,
			source: { kind: "app_field", field: "amount" },
		});
	});
});
