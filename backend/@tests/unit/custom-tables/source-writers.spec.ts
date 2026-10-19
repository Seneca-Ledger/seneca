import { BadRequestException } from "@nestjs/common";
import { Permission } from "../../../src/common/enums/permissions.enum";
import { SOURCE_FIELD_ACCESS } from "../../../src/contracts";
import { BudgetsSource } from "../../../src/modules/custom-tables/sources/budgets.source";
import { InvoicesSource } from "../../../src/modules/custom-tables/sources/invoices.source";
import { PayablesSource } from "../../../src/modules/custom-tables/sources/payables.source";
import { SubscriptionsSource } from "../../../src/modules/custom-tables/sources/subscriptions.source";
import { TransactionsSource } from "../../../src/modules/custom-tables/sources/transactions.source";
import {
	buildSourceWriters,
	type WriteContext,
	type WriterServices,
} from "../../../src/modules/custom-tables/write-back/source-writers";

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const WS = "ws-1";
const USER = "user-1";
const MEMBER = "member-1";

const services = () => ({
	transactions: { update: jest.fn().mockResolvedValue({}) },
	subscriptions: { update: jest.fn().mockResolvedValue({}) },
	payables: {
		findOne: jest.fn().mockResolvedValue({ status: "to_pay", paidAmount: 0 }),
		update: jest.fn().mockResolvedValue({}),
		markAsPaid: jest.fn().mockResolvedValue({}),
		archive: jest.fn().mockResolvedValue({}),
		listPayments: jest.fn().mockResolvedValue([]),
		removePayment: jest.fn().mockResolvedValue({}),
	},
	invoices: { update: jest.fn().mockResolvedValue({}) },
	budgets: { update: jest.fn().mockResolvedValue({}) },
	documents: { followTransactionCategory: jest.fn().mockResolvedValue(undefined) },
});

const context = (overrides: Partial<WriteContext> = {}): WriteContext => ({
	workspaceId: WS,
	userId: USER,
	memberId: MEMBER,
	sourceKey: ID,
	current: {},
	resolveCategory: jest.fn().mockResolvedValue(null),
	resolveClient: jest.fn().mockResolvedValue(null),
	...overrides,
});

/** Error code carried by a Nest exception thrown with `appError`. */
const codeOf = async (promise: Promise<unknown>): Promise<string> => {
	try {
		await promise;
	} catch (error) {
		expect(error).toBeInstanceOf(BadRequestException);
		return ((error as BadRequestException).getResponse() as { code: string }).code;
	}
	throw new Error("expected a rejection");
};

describe("source writers", () => {
	describe("permissions", () => {
		it("asks for the permission each record's own endpoint requires", () => {
			const writers = buildSourceWriters(services() as unknown as WriterServices);
			expect(writers.transactions.permission).toBe(Permission.TRANSACTION_EDIT);
			expect(writers.subscriptions.permission).toBe(Permission.SUBSCRIPTION_EDIT);
			expect(writers.payables.permission).toBe(Permission.PAYABLE_EDIT);
			expect(writers.invoices.permission).toBe(Permission.INVOICE_EDIT);
			expect(writers.budgets.permission).toBe(Permission.BUDGET_EDIT);
		});

		it("marks the records whose audit lives only in their controller", () => {
			const writers = buildSourceWriters(services() as unknown as WriterServices);
			expect(writers.payables.auditEntity).toBe("payable");
			expect(writers.invoices.auditEntity).toBe("invoice");
			expect(writers.transactions.auditEntity).toBeUndefined();
			expect(writers.subscriptions.auditEntity).toBeUndefined();
			expect(writers.budgets.auditEntity).toBeUndefined();
		});
	});

	describe("transactions", () => {
		const update = async (field: string, value: unknown, ctx = context()) => {
			const svc = services();
			await buildSourceWriters(svc as unknown as WriterServices).transactions.write(
				field,
				value,
				ctx,
			);
			return svc.transactions.update;
		};

		it.each([
			["date", "2024-09-02", { transactionDate: "2024-09-02" }],
			["counterparty", " Deutsche Bahn ", { counterpartyName: "Deutsche Bahn" }],
			["counterparty", null, { counterpartyName: "" }],
			["purpose", "ICE Berlin", { paymentPurpose: "ICE Berlin" }],
			["currency", "usd", { currency: "USD" }],
		])("maps %s=%p to exactly %p", async (field, value, body) => {
			const fn = await update(field, value);
			expect(fn).toHaveBeenCalledTimes(1);
			expect(fn).toHaveBeenCalledWith(ID, WS, USER, body, null, MEMBER);
		});

		it("writes a negative amount to the debit side and clears the credit", async () => {
			const fn = await update("amount", -67.4);
			expect(fn.mock.calls[0][3]).toEqual({ debit: 67.4, credit: null });
		});

		it("writes a positive amount to the credit side and clears the debit", async () => {
			const fn = await update("amount", 2800);
			expect(fn.mock.calls[0][3]).toEqual({ credit: 2800, debit: null });
		});

		it("accepts a numeric string amount", async () => {
			const fn = await update("amount", "-13.80");
			expect(fn.mock.calls[0][3]).toEqual({ debit: 13.8, credit: null });
		});

		it("flips the type by moving the current magnitude to the other side", async () => {
			const fn = await update("type", "income", context({ current: { amount: -650, type: "expense" } }));
			expect(fn.mock.calls[0][3]).toEqual({ credit: 650, debit: null });
			const back = await update("type", "expense", context({ current: { amount: 650, type: "income" } }));
			expect(back.mock.calls[0][3]).toEqual({ debit: 650, credit: null });
		});

		it("resolves the category by name with the transaction's own type first", async () => {
			const resolveCategory = jest.fn().mockResolvedValue("cat-travel");
			const fn = await update(
				"category",
				"Travel",
				context({ current: { type: "income" }, resolveCategory }),
			);
			expect(resolveCategory).toHaveBeenCalledWith("Travel", "income");
			expect(fn.mock.calls[0][3]).toEqual({ categoryId: "cat-travel" });
		});

		it("clears the category for an empty cell without a lookup", async () => {
			const resolveCategory = jest.fn();
			const fn = await update("category", "", context({ resolveCategory }));
			expect(resolveCategory).not.toHaveBeenCalled();
			expect(fn.mock.calls[0][3]).toEqual({ categoryId: null });
		});

		it("lets a scanned receipt's document follow a new category, after the update", async () => {
			const svc = services();
			const order: string[] = [];
			svc.transactions.update.mockImplementation(async () => order.push("update"));
			svc.documents.followTransactionCategory.mockImplementation(async () => {
				order.push("follow");
			});
			await buildSourceWriters(svc as unknown as WriterServices).transactions.write(
				"category",
				"",
				context(),
			);
			expect(svc.documents.followTransactionCategory).toHaveBeenCalledWith(ID, WS);
			expect(order).toEqual(["update", "follow"]);
		});

		it.each([["currency", "USD"], ["amount", -1], ["purpose", "x"]])(
			"leaves the document alone when %s changes",
			async (field, value) => {
				const svc = services();
				await buildSourceWriters(svc as unknown as WriterServices).transactions.write(
					field,
					value,
					context({ current: { amount: -1, type: "expense" } }),
				);
				expect(svc.documents.followTransactionCategory).not.toHaveBeenCalled();
			},
		);

		it("does not touch the document when the app refuses the category", async () => {
			const svc = services();
			svc.transactions.update.mockRejectedValue(new BadRequestException({ code: "TAX_LOCKED" }));
			const writer = buildSourceWriters(svc as unknown as WriterServices).transactions;
			await expect(writer.write("category", "", context())).rejects.toBeInstanceOf(
				BadRequestException,
			);
			expect(svc.documents.followTransactionCategory).not.toHaveBeenCalled();
		});

		it("refuses an unknown category and never creates one", async () => {
			const svc = services();
			const writer = buildSourceWriters(svc as unknown as WriterServices).transactions;
			expect(await codeOf(writer.write("category", "Nope", context()))).toBe("CATEGORY_NOT_FOUND");
			expect(svc.transactions.update).not.toHaveBeenCalled();
		});

		it.each([
			["date", "2024-02-30"],
			["date", "yesterday"],
			["date", ""],
			["amount", "abc"],
			["amount", null],
			["type", "transfer"],
			["currency", "EURO"],
			["currency", ""],
		])("refuses %s=%p before calling the app", async (field, value) => {
			const svc = services();
			const writer = buildSourceWriters(svc as unknown as WriterServices).transactions;
			expect(await codeOf(writer.write(field, value, context()))).toBe("INVALID_CELL_VALUE");
			expect(svc.transactions.update).not.toHaveBeenCalled();
		});

		it("refuses the statement file name", async () => {
			const svc = services();
			const writer = buildSourceWriters(svc as unknown as WriterServices).transactions;
			expect(await codeOf(writer.write("statement", "x.csv", context()))).toBe(
				"SOURCE_FIELD_READ_ONLY",
			);
			expect(svc.transactions.update).not.toHaveBeenCalled();
		});

		it("reverts by writing the original value back the same way", async () => {
			const svc = services();
			const writer = buildSourceWriters(svc as unknown as WriterServices).transactions;
			await writer.revert("amount", -49, null, context());
			expect(svc.transactions.update.mock.calls[0][3]).toEqual({ debit: 49, credit: null });
		});
	});

	describe("subscriptions", () => {
		it.each([
			["vendor", "Figma", { vendorName: "Figma" }],
			["amount", 36, { amount: 36 }],
			["currency", "eur", { currency: "EUR" }],
			["frequency", "annual", { frequency: "annual" }],
			["status", "paused", { status: "paused" }],
			["nextChargeDate", "2024-10-08", { nextChargeDate: "2024-10-08" }],
			["nextChargeDate", "", { nextChargeDate: null }],
		])("maps %s=%p to exactly %p", async (field, value, body) => {
			const svc = services();
			await buildSourceWriters(svc as unknown as WriterServices).subscriptions.write(
				field,
				value,
				context(),
			);
			expect(svc.subscriptions.update).toHaveBeenCalledWith(ID, WS, USER, body);
		});

		it("resolves the category as an expense category", async () => {
			const svc = services();
			const resolveCategory = jest.fn().mockResolvedValue("cat-it");
			await buildSourceWriters(svc as unknown as WriterServices).subscriptions.write(
				"category",
				"IT services",
				context({ resolveCategory }),
			);
			expect(resolveCategory).toHaveBeenCalledWith("IT services", "expense");
			expect(svc.subscriptions.update.mock.calls[0][3]).toEqual({ categoryId: "cat-it" });
		});

		it.each([
			["vendor", ""],
			["amount", -1],
			["frequency", "daily"],
			["status", "deleted"],
		])("refuses %s=%p", async (field, value) => {
			const svc = services();
			const writer = buildSourceWriters(svc as unknown as WriterServices).subscriptions;
			expect(await codeOf(writer.write(field, value, context()))).toBe("INVALID_CELL_VALUE");
			expect(svc.subscriptions.update).not.toHaveBeenCalled();
		});

		it("refuses the last charge date, which the app keeps itself", async () => {
			const writer = buildSourceWriters(services() as unknown as WriterServices).subscriptions;
			expect(await codeOf(writer.write("lastChargeDate", "2024-01-01", context()))).toBe(
				"SOURCE_FIELD_READ_ONLY",
			);
		});
	});

	describe("payables", () => {
		it.each([
			["direction", "receivable", { direction: "receivable" }],
			["vendor", "WeWork", { vendor: "WeWork" }],
			["amount", 650, { amount: 650 }],
			["currency", "eur", { currency: "EUR" }],
			["dueDate", "2024-09-30", { dueDate: "2024-09-30" }],
			["isRecurring", true, { isRecurring: true }],
			["comment", "", { comment: null }],
			["status", "scheduled", { status: "scheduled" }],
		])("maps %s=%p to exactly %p", async (field, value, body) => {
			const svc = services();
			await buildSourceWriters(svc as unknown as WriterServices).payables.write(
				field,
				value,
				context(),
			);
			expect(svc.payables.update).toHaveBeenCalledWith(ID, WS, USER, body);
		});

		it("marks a bill paid through markAsPaid and keeps the payment it created", async () => {
			const svc = services();
			svc.payables.listPayments
				.mockResolvedValueOnce([{ id: "old" }])
				.mockResolvedValueOnce([{ id: "old" }, { id: "new" }]);
			const meta = await buildSourceWriters(svc as unknown as WriterServices).payables.write(
				"status",
				"paid",
				context(),
			);
			expect(svc.payables.markAsPaid).toHaveBeenCalledWith(ID, WS, USER, {});
			expect(svc.payables.update).not.toHaveBeenCalled();
			expect(meta).toEqual({ paymentId: "new" });
		});

		it("archives through archive", async () => {
			const svc = services();
			await buildSourceWriters(svc as unknown as WriterServices).payables.write(
				"status",
				"archived",
				context(),
			);
			expect(svc.payables.archive).toHaveBeenCalledWith(ID, WS, USER);
			expect(svc.payables.update).not.toHaveBeenCalled();
		});

		it("does nothing when the status is already the chosen one", async () => {
			const svc = services();
			svc.payables.findOne.mockResolvedValue({ status: "scheduled", paidAmount: 0 });
			await buildSourceWriters(svc as unknown as WriterServices).payables.write(
				"status",
				"scheduled",
				context(),
			);
			expect(svc.payables.update).not.toHaveBeenCalled();
			expect(svc.payables.markAsPaid).not.toHaveBeenCalled();
		});

		it.each([["paid"], ["partially_paid"]])(
			"refuses to un-pay a %s bill: its status follows the payments",
			async status => {
				const svc = services();
				svc.payables.findOne.mockResolvedValue({ status, paidAmount: 100 });
				const writer = buildSourceWriters(svc as unknown as WriterServices).payables;
				expect(await codeOf(writer.write("status", "to_pay", context()))).toBe(
					"PAYABLE_STATUS_FROM_PAYMENTS",
				);
				expect(svc.payables.update).not.toHaveBeenCalled();
			},
		);

		it("refuses partially_paid as a choice", async () => {
			const svc = services();
			const writer = buildSourceWriters(svc as unknown as WriterServices).payables;
			expect(await codeOf(writer.write("status", "partially_paid", context()))).toBe(
				"PAYABLE_STATUS_FROM_PAYMENTS",
			);
		});

		it.each([["source"], ["paidAt"]])("refuses %s", async field => {
			const writer = buildSourceWriters(services() as unknown as WriterServices).payables;
			expect(await codeOf(writer.write(field, "manual", context()))).toBe(
				"SOURCE_FIELD_READ_ONLY",
			);
		});

		it("reverts a table payment by removing exactly it, then restores the status", async () => {
			const svc = services();
			svc.payables.findOne.mockResolvedValue({ status: "to_pay", paidAmount: 0 });
			await buildSourceWriters(svc as unknown as WriterServices).payables.revert(
				"status",
				"scheduled",
				{ paymentId: "pay-1" },
				context(),
			);
			expect(svc.payables.removePayment).toHaveBeenCalledWith(ID, "pay-1", WS);
			expect(svc.payables.update).toHaveBeenCalledWith(ID, WS, USER, { status: "scheduled" });
			expect(svc.payables.markAsPaid).not.toHaveBeenCalled();
		});

		it("reverts an archived bill back to paid without paying again", async () => {
			const svc = services();
			svc.payables.findOne.mockResolvedValue({ status: "archived", paidAmount: 100 });
			await buildSourceWriters(svc as unknown as WriterServices).payables.revert(
				"status",
				"paid",
				null,
				context(),
			);
			expect(svc.payables.markAsPaid).not.toHaveBeenCalled();
			expect(svc.payables.update).toHaveBeenCalledWith(ID, WS, USER, { status: "paid" });
		});
	});

	describe("invoices", () => {
		it.each([
			["issueDate", "2024-09-01", { issueDate: "2024-09-01" }],
			["dueDate", "2024-09-15", { dueDate: "2024-09-15" }],
			["currency", "gbp", { currency: "GBP" }],
			["notes", "Thanks", { notes: "Thanks" }],
			["notes", "", { notes: null }],
		])("maps %s=%p to exactly %p", async (field, value, body) => {
			const svc = services();
			await buildSourceWriters(svc as unknown as WriterServices).invoices.write(
				field,
				value,
				context(),
			);
			expect(svc.invoices.update).toHaveBeenCalledWith(ID, WS, body);
		});

		it("resolves the client by name", async () => {
			const svc = services();
			const resolveClient = jest.fn().mockResolvedValue("client-1");
			await buildSourceWriters(svc as unknown as WriterServices).invoices.write(
				"client",
				"Northwind Labs",
				context({ resolveClient }),
			);
			expect(resolveClient).toHaveBeenCalledWith("Northwind Labs");
			expect(svc.invoices.update).toHaveBeenCalledWith(ID, WS, { clientId: "client-1" });
		});

		it("refuses an unknown client", async () => {
			const svc = services();
			const writer = buildSourceWriters(svc as unknown as WriterServices).invoices;
			expect(await codeOf(writer.write("client", "Nobody", context()))).toBe(
				"INVOICE_CLIENT_NOT_FOUND",
			);
			expect(svc.invoices.update).not.toHaveBeenCalled();
		});

		it.each([["invoiceNumber"], ["status"], ["subtotal"], ["taxTotal"], ["total"]])(
			"refuses %s",
			async field => {
				const writer = buildSourceWriters(services() as unknown as WriterServices).invoices;
				expect(await codeOf(writer.write(field, "1", context()))).toBe("SOURCE_FIELD_READ_ONLY");
			},
		);
	});

	describe("budgets", () => {
		it.each([
			["name", "Travel", { name: "Travel" }],
			["limit", "500", { limitAmount: 500 }],
			["currency", "eur", { currency: "EUR" }],
		])("maps %s=%p to exactly %p", async (field, value, body) => {
			const svc = services();
			await buildSourceWriters(svc as unknown as WriterServices).budgets.write(
				field,
				value,
				context(),
			);
			expect(svc.budgets.update).toHaveBeenCalledWith(ID, WS, USER, body);
		});

		it("never writes an empty name, which the service would store as null", async () => {
			const svc = services();
			const writer = buildSourceWriters(svc as unknown as WriterServices).budgets;
			expect(await codeOf(writer.write("name", " ", context()))).toBe("INVALID_CELL_VALUE");
			expect(svc.budgets.update).not.toHaveBeenCalled();
		});

		it.each([
			["category"],
			["spent"],
			["remaining"],
			["percentUsed"],
			["periodType"],
			["periodStart"],
		])("refuses the derived or create-only %s", async field => {
			const writer = buildSourceWriters(services() as unknown as WriterServices).budgets;
			expect(await codeOf(writer.write(field, 1, context()))).toBe("SOURCE_FIELD_READ_ONLY");
		});
	});

	describe("the shared field access map", () => {
		const adapters = {
			transactions: new TransactionsSource({} as never),
			subscriptions: new SubscriptionsSource({} as never),
			payables: new PayablesSource({} as never),
			invoices: new InvoicesSource({} as never),
			budgets: new BudgetsSource({} as never),
		};

		it.each(Object.keys(adapters))("lists every column of the %s source, and nothing else", kind => {
			const fields = adapters[kind as keyof typeof adapters].columns.map(column => column.field);
			expect(Object.keys(SOURCE_FIELD_ACCESS[kind as keyof typeof SOURCE_FIELD_ACCESS]).sort()).toEqual(
				[...fields].sort(),
			);
		});

		const entries = Object.entries(SOURCE_FIELD_ACCESS).flatMap(([kind, fields]) =>
			Object.entries(fields).map(([field, access]) => [kind, field, access] as const),
		);

		it.each(entries.filter(([, , access]) => access === "read"))(
			"the %s writer refuses read-only %s",
			async (kind, field) => {
				const writer = buildSourceWriters(services() as unknown as WriterServices)[kind];
				expect(await codeOf(writer.write(field, "x", context()))).toBe("SOURCE_FIELD_READ_ONLY");
			},
		);

		it.each(entries.filter(([, , access]) => access === "write"))(
			"the %s writer handles writable %s",
			async (kind, field) => {
				const writer = buildSourceWriters(services() as unknown as WriterServices)[kind];
				// Whatever the value, a writable field never answers "read-only".
				const code = await writer
					.write(field, "x", context())
					.then(() => null)
					.catch(error => (error.getResponse?.() as { code?: string } | undefined)?.code ?? null);
				expect(code).not.toBe("SOURCE_FIELD_READ_ONLY");
			},
		);
	});
});
