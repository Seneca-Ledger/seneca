import type { CustomTableColumn, CustomTableGridRow, CustomTableRowPatch } from '../utils/types';

/**
 * Черновик — строка, которой ещё нет на сервере. Кнопка «+» создаёт её локально,
 * POST уходит только когда заполнены обязательные колонки: пустую строку бэкенд
 * отвергает, пока в таблице есть хоть одна колонка с isRequired.
 */
export const DRAFT_ROW_ID_PREFIX = 'temp-';

export const isDraftRowId = (rowId: string): boolean => rowId.startsWith(DRAFT_ROW_ID_PREFIX);

/** Повторяет isBlankCellValue из backend/custom-tables.service.ts. */
export const isBlankCellValue = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return String(value).trim() === '';
};

export const createDraftRow = (seq: number, rowNumber: number): CustomTableGridRow => ({
  id: `${DRAFT_ROW_ID_PREFIX}${seq}`,
  rowNumber,
  data: {},
});

/**
 * Считается по всем колонкам таблицы, а не по видимым: скрытая обязательная
 * колонка иначе молча ломала бы запись.
 */
export const isDraftReadyToSave = (
  data: CustomTableRowPatch,
  columns: CustomTableColumn[],
): boolean => {
  const required = columns.filter(col => col.isRequired);
  if (!required.length) {
    return Object.values(data).some(value => !isBlankCellValue(value));
  }
  return required.every(col => !isBlankCellValue(data[col.key]));
};

/** Ячейка черновика, без которой строка не сохранится, — её подсвечивает грид. */
export const isMissingRequiredCell = (row: CustomTableGridRow, col: CustomTableColumn): boolean =>
  Boolean(col.isRequired) && isDraftRowId(row.id) && isBlankCellValue(row.data?.[col.key]);
