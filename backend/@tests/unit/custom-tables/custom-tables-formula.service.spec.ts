import { CustomTableColumnType } from "../../../src/entities/custom-table-column.entity";
import { CustomTablesService } from "../../../src/modules/custom-tables/custom-tables.service";

const TABLE_ID = "11111111-1111-4111-8111-111111111111";

const createRepositoryMock = () => ({
	findOne: jest.fn(),
	find: jest.fn(),
	save: jest.fn(),
	create: jest.fn((value?: unknown) => value),
	delete: jest.fn(),
	update: jest.fn(),
	createQueryBuilder: jest.fn(),
});

const tableQueryBuilder = () => {
	const qb: Record<string, jest.Mock> = {};
	for (const method of ["leftJoinAndSelect", "where", "andWhere", "orderBy"]) {
		qb[method] = jest.fn().mockReturnValue(qb);
	}
	qb.getOne = jest.fn().mockResolvedValue({ id: TABLE_ID, workspaceId: "workspace-1" });
	return qb;
};

const COLUMNS = [
	{ key: "col_amount", title: "Сумма", type: CustomTableColumnType.CURRENCY, config: null },
	{ key: "col_qty", title: "Qty", type: CustomTableColumnType.NUMBER, config: null },
	{
		key: "col_total",
		title: "Total",
		type: CustomTableColumnType.FORMULA,
		config: { expression: "[col_amount] * [col_qty]", resultType: "number" },
	},
	{
		key: "col_share",
		title: "Share",
		type: CustomTableColumnType.FORMULA,
		config: { expression: "[col_total] / 100", resultType: "number" },
	},
];

function build() {
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
	repos.workspaceMember.findOne.mockResolvedValue({ role: "owner", permissions: {} });
	repos.customTable.createQueryBuilder.mockReturnValue(tableQueryBuilder());
	repos.column.find.mockResolvedValue(COLUMNS.map((col) => ({ ...col })));
	repos.row.findOne.mockResolvedValue({
		id: "row-1",
		tableId: TABLE_ID,
		rowNumber: 1,
		data: { col_amount: 1500, col_qty: 2 },
	});
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
		{ createEvent: jest.fn(), createBatchEvents: jest.fn() } as never,
	);
	return { service, repos };
}

describe("CustomTablesService.previewFormula", () => {
	it("resolves column titles to keys and computes the example on the first row", async () => {
		const { service } = build();
		const result = await service.previewFormula("user-1", "workspace-1", TABLE_ID, {
			expression: "[Сумма] * [qty] + [Total]",
		});
		expect(result).toEqual({
			valid: true,
			error: null,
			expression: "[col_amount] * [col_qty] + [col_total]",
			resultType: "number",
			sample: 6000,
		});
	});

	it("infers text results and evaluates other formula columns first", async () => {
		const { service } = build();
		const result = await service.previewFormula("user-1", "workspace-1", TABLE_ID, {
			expression: 'IF([Share] > 10, "big", "small")',
		});
		expect(result).toMatchObject({ valid: true, resultType: "text", sample: "big" });
	});

	it("rejects a cycle through another formula column", async () => {
		const { service } = build();
		const result = await service.previewFormula("user-1", "workspace-1", TABLE_ID, {
			expression: "[Share] + 1",
			columnKey: "col_total",
		});
		expect(result.valid).toBe(false);
		expect(result.error).toMatch(/refers to itself/);
	});

	it("reports unknown columns and functions instead of throwing", async () => {
		const { service } = build();
		const missing = await service.previewFormula("user-1", "workspace-1", TABLE_ID, {
			expression: "[Ghost] + 1",
		});
		expect(missing).toMatchObject({ valid: false, error: "Column not found: Ghost" });
		const unknown = await service.previewFormula("user-1", "workspace-1", TABLE_ID, {
			expression: "FOO(1)",
		});
		expect(unknown.error).toMatch(/Unknown function/);
	});
});
