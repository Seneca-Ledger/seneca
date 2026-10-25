import type { Mock } from 'vitest';
import {
	AuditAction,
	EntityType,
	Severity,
} from "../../../src/entities/audit-event.entity";
import { CustomTableSource } from "../../../src/entities/custom-table.entity";
import { CustomTableColumnType } from "../../../src/entities/custom-table-column.entity";
import { TransactionType } from "../../../src/entities/transaction.entity";
import { CustomTablesService } from "../../../src/modules/custom-tables/custom-tables.service";
import { workspaceCurrencyStub } from '../../helpers/workspace-currency-stub';

const createRepositoryMock = () => ({
	findOne: vi.fn(),
	find: vi.fn(),
	save: vi.fn(),
	create: vi.fn((value?: unknown) => value),
	delete: vi.fn(),
	update: vi.fn(),
	count: vi.fn().mockResolvedValue(0),
	createQueryBuilder: vi.fn(),
});

const TABLE_ID = "11111111-1111-4111-8111-111111111111";

const buildCustomTablesService = (classificationService?: {
	classifyTransaction: Mock;
}) => {
	const customTableRepository = createRepositoryMock();
	const categoryRepository = createRepositoryMock();
	const customTableColumnRepository = createRepositoryMock();
	const customTableRowRepository = createRepositoryMock();
	const customTableColumnStyleRepository = createRepositoryMock();
	const customTableCellStyleRepository = createRepositoryMock();
	const dataEntryRepository = createRepositoryMock();
	const dataEntryCustomFieldRepository = createRepositoryMock();
	const statementRepository = createRepositoryMock();
	const transactionRepository = createRepositoryMock();
	const userRepository = createRepositoryMock();
	const workspaceMemberRepository = createRepositoryMock();
	const auditService = {
		createEvent: vi.fn().mockResolvedValue(undefined),
		createBatchEvents: vi.fn().mockResolvedValue(undefined),
	};

	const service = new CustomTablesService(
		customTableRepository as never,
		categoryRepository as never,
		customTableColumnRepository as never,
		customTableRowRepository as never,
		customTableColumnStyleRepository as never,
		customTableCellStyleRepository as never,
		dataEntryRepository as never,
		dataEntryCustomFieldRepository as never,
		statementRepository as never,
		transactionRepository as never,
		userRepository as never,
		workspaceMemberRepository as never,
		auditService as never,
		classificationService as never,
		undefined,
		undefined,
		workspaceCurrencyStub('EUR') as never,
	);

	return {
		service,
		customTableRepository,
		customTableColumnRepository,
		customTableRowRepository,
		customTableColumnStyleRepository,
		statementRepository,
		transactionRepository,
		workspaceMemberRepository,
		auditService,
	};
};

const mockRequireTable = (
	customTableRepository: ReturnType<typeof createRepositoryMock>,
	table: Record<string, unknown> = {},
) => {
	const queryBuilder = {
		leftJoinAndSelect: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		andWhere: vi.fn().mockReturnThis(),
		getOne: vi.fn().mockResolvedValue({
			id: TABLE_ID,
			userId: "user-1",
			workspaceId: "workspace-1",
			name: "March expenses",
			description: null,
			source: CustomTableSource.MANUAL,
			categoryId: null,
			...table,
		}),
	};
	customTableRepository.createQueryBuilder.mockReturnValue(queryBuilder);
	return queryBuilder;
};

const mockMissingTable = (
	customTableRepository: ReturnType<typeof createRepositoryMock>,
) => {
	const queryBuilder = {
		leftJoinAndSelect: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		andWhere: vi.fn().mockReturnThis(),
		getOne: vi.fn().mockResolvedValue(null),
	};
	customTableRepository.createQueryBuilder.mockReturnValue(queryBuilder);
	return queryBuilder;
};

const buildConversionColumns = () => [
	{
		id: "col-date",
		key: "date-key",
		title: "Дата",
		type: CustomTableColumnType.DATE,
		position: 0,
	},
	{
		id: "col-merchant",
		key: "merchant-key",
		title: "Контрагент",
		type: CustomTableColumnType.TEXT,
		position: 1,
	},
	{
		id: "col-purpose",
		key: "purpose-key",
		title: "Описание",
		type: CustomTableColumnType.TEXT,
		position: 2,
	},
	{
		id: "col-amount",
		key: "amount-key",
		title: "Сумма",
		type: CustomTableColumnType.NUMBER,
		position: 3,
	},
	{
		id: "col-article",
		key: "article-key",
		title: "Статья",
		type: CustomTableColumnType.TEXT,
		position: 4,
	},
	{
		id: "col-currency",
		key: "currency-key",
		title: "Валюта",
		type: CustomTableColumnType.TEXT,
		position: 5,
	},
];

const buildEnglishDebitColumns = () => [
	{
		id: "col-date",
		key: "date-key",
		title: "Date",
		type: CustomTableColumnType.DATE,
		position: 0,
	},
	{
		id: "col-merchant",
		key: "merchant-key",
		title: "Counterparty",
		type: CustomTableColumnType.TEXT,
		position: 1,
	},
	{
		id: "col-purpose",
		key: "purpose-key",
		title: "Purpose",
		type: CustomTableColumnType.TEXT,
		position: 2,
	},
	{
		id: "col-debit",
		key: "debit-key",
		title: "Debit",
		type: CustomTableColumnType.NUMBER,
		position: 3,
	},
	{
		id: "col-article",
		key: "article-key",
		title: "Article",
		type: CustomTableColumnType.TEXT,
		position: 4,
	},
];

describe("CustomTablesService.convertToStatement", () => {
	const originalUploadsDir = process.env.UPLOADS_DIR;

	beforeEach(() => {
		process.env.UPLOADS_DIR = "/tmp/seneca-custom-table-tests";
	});

	afterEach(() => {
		process.env.UPLOADS_DIR = originalUploadsDir;
		vi.clearAllMocks();
	});

	it("categorizes converted transactions through the workspace classifier", async () => {
		const classificationService = {
			classifyTransaction: vi.fn().mockResolvedValue({
				categoryId: "cat-food",
				categorySource: "history",
				categoryReason: "Magnum",
			}),
		};
		const {
			service,
			customTableRepository,
			customTableColumnRepository,
			customTableRowRepository,
			statementRepository,
			transactionRepository,
			workspaceMemberRepository,
		} = buildCustomTablesService(classificationService);

		mockRequireTable(customTableRepository);
		workspaceMemberRepository.findOne.mockResolvedValue({
			role: "owner",
			permissions: {},
		});
		customTableColumnRepository.find.mockResolvedValue(
			buildConversionColumns(),
		);
		customTableRowRepository.find.mockResolvedValue([
			{
				id: "row-1",
				rowNumber: 1,
				data: {
					"date-key": "2026-03-29",
					"merchant-key": "Magnum",
					"amount-key": 500,
				},
			},
		]);
		statementRepository.createQueryBuilder.mockReturnValue({
			where: vi.fn().mockReturnThis(),
			andWhere: vi.fn().mockReturnThis(),
			getOne: vi.fn().mockResolvedValue(null),
		});
		statementRepository.create.mockImplementation((value?: unknown) => value);
		statementRepository.save.mockImplementation(async (value) => ({
			id: "generated-statement-1",
			...(value as Record<string, unknown>),
		}));
		transactionRepository.create.mockImplementation((value?: unknown) => value);
		transactionRepository.save.mockImplementation(async (values) =>
			(values as Array<Record<string, unknown>>).map((value, index) => ({
				id: `tx-${index}`,
				...value,
			})),
		);

		await service.convertToStatement("user-1", "workspace-1", TABLE_ID);

		expect(classificationService.classifyTransaction).toHaveBeenCalledWith(
			expect.objectContaining({ counterpartyName: "Magnum" }),
			"user-1",
		);
		expect(transactionRepository.update).toHaveBeenCalledWith(
			{ id: "tx-0" },
			{
				categoryId: "cat-food",
				categorySource: "history",
				categoryReason: "Magnum",
			},
		);
	});

	it("creates one statement with expense transactions and article values from valid table rows", async () => {
		const {
			service,
			customTableRepository,
			customTableColumnRepository,
			customTableRowRepository,
			statementRepository,
			transactionRepository,
			workspaceMemberRepository,
		} = buildCustomTablesService();

		mockRequireTable(customTableRepository);
		workspaceMemberRepository.findOne.mockResolvedValue({
			role: "owner",
			permissions: {},
		});
		customTableColumnRepository.find.mockResolvedValue(
			buildConversionColumns(),
		);
		customTableRowRepository.find.mockResolvedValue([
			{
				id: "row-1",
				rowNumber: 1,
				data: {
					"date-key": "2026-03-29",
					"merchant-key": "Magnum",
					"purpose-key": "Office groceries",
					"amount-key": 500,
					"article-key": "Office supplies",
					"currency-key": "KZT",
				},
			},
			{
				id: "row-2",
				rowNumber: 2,
				data: {
					"date-key": "bad-date",
					"merchant-key": "Invalid",
					"amount-key": 100,
				},
			},
		]);

		statementRepository.createQueryBuilder.mockReturnValue({
			where: vi.fn().mockReturnThis(),
			andWhere: vi.fn().mockReturnThis(),
			getOne: vi.fn().mockResolvedValue(null),
		});
		statementRepository.create.mockImplementation((value?: unknown) => value);
		statementRepository.save.mockImplementation(async (value) => ({
			id: "generated-statement-1",
			...(value as Record<string, unknown>),
		}));
		transactionRepository.create.mockImplementation((value?: unknown) => value);
		transactionRepository.save.mockImplementation(async (values) => values);

		const result = await service.convertToStatement(
			"user-1",
			"workspace-1",
			TABLE_ID,
		);

		expect(result).toEqual({
			statementId: "generated-statement-1",
			importedRows: 1,
			skippedRows: 1,
			warnings: [expect.stringContaining("row 2")],
		});
		expect(statementRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: "user-1",
				workspaceId: "workspace-1",
				fileName: expect.stringContaining("March expenses"),
				totalTransactions: 1,
				totalDebit: 500,
				totalCredit: 0,
				currency: "KZT",
			}),
		);
		expect(transactionRepository.save).toHaveBeenCalledWith([
			expect.objectContaining({
				workspaceId: "workspace-1",
				statementId: "generated-statement-1",
				counterpartyName: "Magnum",
				paymentPurpose: "Office groceries",
				debit: 500,
				amount: 500,
				currency: "KZT",
				transactionType: TransactionType.EXPENSE,
				article: "Office supplies",
				isVerified: false,
				fingerprint: expect.any(String),
			}),
		]);
	});

	it("replaces prior generated transactions when converting the same table again", async () => {
		const {
			service,
			customTableRepository,
			customTableColumnRepository,
			customTableRowRepository,
			statementRepository,
			transactionRepository,
			workspaceMemberRepository,
		} = buildCustomTablesService();

		mockRequireTable(customTableRepository);
		workspaceMemberRepository.findOne.mockResolvedValue({
			role: "owner",
			permissions: {},
		});
		customTableColumnRepository.find.mockResolvedValue(
			buildConversionColumns(),
		);
		customTableRowRepository.find.mockResolvedValue([
			{
				id: "row-1",
				rowNumber: 1,
				data: {
					"date-key": "2026-03-30",
					"merchant-key": "Taxi",
					"amount-key": 70,
					"article-key": "Transport",
					"currency-key": "KZT",
				},
			},
		]);
		statementRepository.createQueryBuilder.mockReturnValue({
			where: vi.fn().mockReturnThis(),
			andWhere: vi.fn().mockReturnThis(),
			getOne: vi.fn().mockResolvedValue({
				id: "generated-statement-1",
				userId: "user-1",
				workspaceId: "workspace-1",
				fileName: "old.csv",
				filePath: "/tmp/seneca-custom-table-tests/old.csv",
				parsingDetails: {
					importPreview: {
						source: "custom-table-conversion",
						customTableId: TABLE_ID,
					},
				},
			}),
		});
		statementRepository.save.mockImplementation(async (value) => value);
		transactionRepository.create.mockImplementation((value?: unknown) => value);
		transactionRepository.save.mockImplementation(async (values) => values);

		const result = await service.convertToStatement(
			"user-1",
			"workspace-1",
			TABLE_ID,
		);

		expect(result.statementId).toBe("generated-statement-1");
		expect(transactionRepository.delete).toHaveBeenCalledWith({
			statementId: "generated-statement-1",
		});
		// Rows on a filed tax return would be replaced too, so they are looked for first.
		expect(transactionRepository.count).toHaveBeenCalledWith({
			where: {
				statementId: "generated-statement-1",
				workspaceId: "workspace-1",
				taxLocked: true,
			},
		});
		expect(transactionRepository.save).toHaveBeenCalledTimes(1);
	});

	it("maps English column names and positive debit values to expense transactions", async () => {
		const {
			service,
			customTableRepository,
			customTableColumnRepository,
			customTableRowRepository,
			statementRepository,
			transactionRepository,
			workspaceMemberRepository,
		} = buildCustomTablesService();

		mockRequireTable(customTableRepository, { name: "Imported expenses" });
		workspaceMemberRepository.findOne.mockResolvedValue({
			role: "owner",
			permissions: {},
		});
		customTableColumnRepository.find.mockResolvedValue(
			buildEnglishDebitColumns(),
		);
		customTableRowRepository.find.mockResolvedValue([
			{
				id: "row-1",
				rowNumber: 1,
				data: {
					"date-key": "2026-04-01",
					"merchant-key": "Vendor LLC",
					"purpose-key": "Hosting",
					"debit-key": "1 234,50",
					"article-key": "Infrastructure",
				},
			},
		]);

		statementRepository.createQueryBuilder.mockReturnValue({
			where: vi.fn().mockReturnThis(),
			andWhere: vi.fn().mockReturnThis(),
			getOne: vi.fn().mockResolvedValue(null),
		});
		statementRepository.create.mockImplementation((value?: unknown) => value);
		statementRepository.save.mockImplementation(async (value) => ({
			id: "generated-statement-1",
			...(value as Record<string, unknown>),
		}));
		transactionRepository.create.mockImplementation((value?: unknown) => value);
		transactionRepository.save.mockImplementation(async (values) => values);

		await service.convertToStatement("user-1", "workspace-1", TABLE_ID);

		expect(transactionRepository.save).toHaveBeenCalledWith([
			expect.objectContaining({
				counterpartyName: "Vendor LLC",
				paymentPurpose: "Hosting",
				debit: 1234.5,
				amount: 1234.5,
				currency: "EUR",
				transactionType: TransactionType.EXPENSE,
				article: "Infrastructure",
			}),
		]);
	});

	it("fails when all rows have invalid dates or non-positive amounts", async () => {
		const {
			service,
			customTableRepository,
			customTableColumnRepository,
			customTableRowRepository,
			statementRepository,
			transactionRepository,
			workspaceMemberRepository,
		} = buildCustomTablesService();

		mockRequireTable(customTableRepository);
		workspaceMemberRepository.findOne.mockResolvedValue({
			role: "owner",
			permissions: {},
		});
		customTableColumnRepository.find.mockResolvedValue(
			buildConversionColumns(),
		);
		customTableRowRepository.find.mockResolvedValue([
			{
				id: "row-1",
				rowNumber: 1,
				data: {
					"date-key": "bad-date",
					"amount-key": 100,
				},
			},
			{
				id: "row-2",
				rowNumber: 2,
				data: {
					"date-key": "2026-04-02",
					"amount-key": 0,
				},
			},
		]);

		await expect(
			service.convertToStatement("user-1", "workspace-1", TABLE_ID),
		).rejects.toMatchObject({
			response: { code: "TABLE_NO_VALID_ROWS_TO_CONVERT" },
		});
		expect(statementRepository.save).not.toHaveBeenCalled();
		expect(transactionRepository.save).not.toHaveBeenCalled();
	});

	it("rejects tables outside the current workspace scope", async () => {
		const { service, customTableRepository, workspaceMemberRepository } =
			buildCustomTablesService();

		mockMissingTable(customTableRepository);
		workspaceMemberRepository.findOne.mockResolvedValue({
			role: "owner",
			permissions: {},
		});

		await expect(
			service.convertToStatement("user-1", "workspace-2", TABLE_ID),
		).rejects.toMatchObject({ response: { code: "TABLE_NOT_FOUND" } });
	});

	it("rejects users without statement edit permission", async () => {
		const {
			service,
			customTableRepository,
			customTableColumnRepository,
			customTableRowRepository,
			workspaceMemberRepository,
		} = buildCustomTablesService();

		mockRequireTable(customTableRepository);
		workspaceMemberRepository.findOne.mockResolvedValue({
			role: "member",
			permissions: { canEditCustomTables: true, canEditStatements: false },
		});

		await expect(
			service.convertToStatement("user-1", "workspace-1", TABLE_ID),
		).rejects.toMatchObject({
			response: { code: "STATEMENTS_EDIT_FORBIDDEN" },
		});
		expect(customTableColumnRepository.find).not.toHaveBeenCalled();
		expect(customTableRowRepository.find).not.toHaveBeenCalled();
	});
});

describe("CustomTablesService.updateColumnStyle", () => {
	const COLUMN_ID = "22222222-2222-4222-8222-222222222222";

	const setup = (existingStyle: Record<string, unknown> | null) => {
		const built = buildCustomTablesService();
		mockRequireTable(built.customTableRepository);
		built.workspaceMemberRepository.findOne.mockResolvedValue({
			role: "owner",
			permissions: {},
		});
		built.customTableColumnRepository.findOne.mockResolvedValue({
			id: COLUMN_ID,
			key: "col_a",
		});
		built.customTableColumnStyleRepository.findOne.mockResolvedValue(
			existingStyle
				? {
						id: "style-1",
						tableId: TABLE_ID,
						columnKey: "col_a",
						style: existingStyle,
					}
				: null,
		);
		built.customTableColumnStyleRepository.save.mockImplementation(
			async (value: unknown) => value,
		);
		return built;
	};

	it("creates a style row when none exists", async () => {
		const { service, customTableColumnStyleRepository, auditService } =
			setup(null);

		const result = await service.updateColumnStyle(
			"user-1",
			"workspace-1",
			TABLE_ID,
			COLUMN_ID,
			{
				header: { backgroundColor: "#ff0000", textFormat: { bold: true } },
			},
		);

		expect(customTableColumnStyleRepository.findOne).toHaveBeenCalledWith({
			where: { tableId: TABLE_ID, columnKey: "col_a" },
		});
		expect(customTableColumnStyleRepository.save).toHaveBeenCalledWith({
			tableId: TABLE_ID,
			columnKey: "col_a",
			style: {
				header: { backgroundColor: "#ff0000", textFormat: { bold: true } },
			},
		});
		expect(customTableColumnStyleRepository.delete).not.toHaveBeenCalled();
		expect(result).toEqual({
			columnKey: "col_a",
			style: {
				header: { backgroundColor: "#ff0000", textFormat: { bold: true } },
			},
		});
		expect(auditService.createEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				entityType: EntityType.CUSTOM_TABLE_COLUMN,
				entityId: COLUMN_ID,
				action: AuditAction.UPDATE,
				meta: { tableId: TABLE_ID, columnKey: "col_a", columnStyle: true },
			}),
		);
	});

	it("clears one part with null and keeps the other", async () => {
		const { service, customTableColumnStyleRepository } = setup({
			header: { backgroundColor: "#ff0000" },
			cell: { backgroundColor: "#00ff00" },
		});

		const result = await service.updateColumnStyle(
			"user-1",
			"workspace-1",
			TABLE_ID,
			COLUMN_ID,
			{
				header: null,
			},
		);

		expect(customTableColumnStyleRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "style-1",
				style: { cell: { backgroundColor: "#00ff00" } },
			}),
		);
		expect(customTableColumnStyleRepository.delete).not.toHaveBeenCalled();
		expect(result).toEqual({
			columnKey: "col_a",
			style: { cell: { backgroundColor: "#00ff00" } },
		});
	});

	it("deletes the row when both parts end up empty", async () => {
		const { service, customTableColumnStyleRepository } = setup({
			header: { backgroundColor: "#ff0000" },
		});

		const result = await service.updateColumnStyle(
			"user-1",
			"workspace-1",
			TABLE_ID,
			COLUMN_ID,
			{
				header: null,
				cell: {},
			},
		);

		expect(customTableColumnStyleRepository.delete).toHaveBeenCalledWith({
			id: "style-1",
		});
		expect(customTableColumnStyleRepository.save).not.toHaveBeenCalled();
		expect(result).toEqual({ columnKey: "col_a", style: {} });
	});

	it("rejects a column that does not belong to the table", async () => {
		const {
			service,
			customTableColumnRepository,
			customTableColumnStyleRepository,
		} = setup(null);
		customTableColumnRepository.findOne.mockResolvedValue(null);

		await expect(
			service.updateColumnStyle("user-1", "workspace-1", TABLE_ID, COLUMN_ID, {
				header: { backgroundColor: "#ff0000" },
			}),
		).rejects.toMatchObject({ response: { code: "COLUMN_NOT_FOUND" } });
		expect(customTableColumnRepository.findOne).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: COLUMN_ID, tableId: TABLE_ID } }),
		);
		expect(customTableColumnStyleRepository.findOne).not.toHaveBeenCalled();
		expect(customTableColumnStyleRepository.save).not.toHaveBeenCalled();
	});
});
