import {
  type MigrationInterface,
  type QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class FixCustomTableCellStylesRowId1734900000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('custom_table_cell_styles');

    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: 'custom_table_cell_styles',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'row_id', type: 'uuid', isNullable: false },
            { name: 'column_key', type: 'varchar', isNullable: false },
            { name: 'style', type: 'jsonb', default: "'{}'::jsonb" },
            { name: 'created_at', type: 'timestamp', default: 'now()' },
            { name: 'updated_at', type: 'timestamp', default: 'now()' },
          ],
          foreignKeys: [
            {
              columnNames: ['row_id'],
              referencedTableName: 'custom_table_rows',
              referencedColumnNames: ['id'],
              onDelete: 'CASCADE',
            },
          ],
        }),
      );

      await queryRunner.createIndex(
        'custom_table_cell_styles',
        new TableIndex({
          name: 'IDX_custom_table_cell_styles_row_id',
          columnNames: ['row_id'],
        }),
      );
      await queryRunner.createIndex(
        'custom_table_cell_styles',
        new TableIndex({
          name: 'IDX_custom_table_cell_styles_row_id_column_key_unique',
          columnNames: ['row_id', 'column_key'],
          isUnique: true,
        }),
      );
      return;
    }

    const table = await queryRunner.getTable('custom_table_cell_styles');
    if (!table) {
      return;
    }

    const hasRowId = await queryRunner.hasColumn('custom_table_cell_styles', 'row_id');
    if (!hasRowId) {
      await queryRunner.addColumn(
        'custom_table_cell_styles',
        new TableColumn({ name: 'row_id', type: 'uuid', isNullable: true }),
      );
    }

    const hasTableId = await queryRunner.hasColumn('custom_table_cell_styles', 'table_id');
    const hasRowNumber = await queryRunner.hasColumn('custom_table_cell_styles', 'row_number');

    if (hasTableId && hasRowNumber) {
      await queryRunner.query(`
        UPDATE custom_table_cell_styles cs
        SET row_id = r.id
        FROM custom_table_rows r
        WHERE cs.row_id IS NULL
          AND r.table_id = cs.table_id
          AND r.row_number = cs.row_number
      `);
    }

    const nullCountRaw = await queryRunner.query(
      'SELECT COUNT(*)::int AS cnt FROM custom_table_cell_styles WHERE row_id IS NULL',
    );
    const nullCount = Array.isArray(nullCountRaw) ? Number(nullCountRaw[0]?.cnt ?? 0) : 0;
    if (nullCount === 0) {
      await queryRunner.query(
        'ALTER TABLE custom_table_cell_styles ALTER COLUMN row_id SET NOT NULL',
      );
    }

    const idxNamesToDrop = new Set([
      'IDX_custom_table_cell_styles_table_id',
      'IDX_custom_table_cell_styles_table_row_col_unique',
      'idx_custom_table_cell_styles_row_column_key_unique',
      'idx_custom_table_cell_styles_row_id',
    ]);
    for (const idx of table.indices) {
      if (idx.name && idxNamesToDrop.has(idx.name)) {
        await queryRunner.dropIndex('custom_table_cell_styles', idx);
      }
    }

    const hasRowIdIndex = (await queryRunner.getTable('custom_table_cell_styles'))?.indices?.some(
      i => i.name === 'IDX_custom_table_cell_styles_row_id',
    );
    if (!hasRowIdIndex) {
      await queryRunner.createIndex(
        'custom_table_cell_styles',
        new TableIndex({
          name: 'IDX_custom_table_cell_styles_row_id',
          columnNames: ['row_id'],
        }),
      );
    }

    const hasUnique = (await queryRunner.getTable('custom_table_cell_styles'))?.indices?.some(
      i => i.name === 'IDX_custom_table_cell_styles_row_id_column_key_unique',
    );
    if (!hasUnique) {
      await queryRunner.createIndex(
        'custom_table_cell_styles',
        new TableIndex({
          name: 'IDX_custom_table_cell_styles_row_id_column_key_unique',
          columnNames: ['row_id', 'column_key'],
          isUnique: true,
        }),
      );
    }

    const refreshed = await queryRunner.getTable('custom_table_cell_styles');
    if (!refreshed) {
      return;
    }
    const hasFk = refreshed.foreignKeys.some(
      fk =>
        fk.columnNames.length === 1 &&
        fk.columnNames[0] === 'row_id' &&
        fk.referencedTableName === 'custom_table_rows',
    );
    if (!hasFk) {
      await queryRunner.createForeignKey(
        'custom_table_cell_styles',
        new TableForeignKey({
          columnNames: ['row_id'],
          referencedTableName: 'custom_table_rows',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('custom_table_cell_styles');
    if (!hasTable) {
      return;
    }

    const table = await queryRunner.getTable('custom_table_cell_styles');
    if (!table) {
      return;
    }

    const idxToDrop = table.indices.filter(
      i =>
        i.name !== undefined &&
        [
          'IDX_custom_table_cell_styles_row_id',
          'IDX_custom_table_cell_styles_row_id_column_key_unique',
        ].includes(i.name),
    );
    for (const idx of idxToDrop) {
      await queryRunner.dropIndex('custom_table_cell_styles', idx);
    }

    const fkToDrop = table.foreignKeys.filter(
      fk =>
        fk.columnNames.length === 1 &&
        fk.columnNames[0] === 'row_id' &&
        fk.referencedTableName === 'custom_table_rows',
    );
    for (const fk of fkToDrop) {
      await queryRunner.dropForeignKey('custom_table_cell_styles', fk);
    }

    const hasRowId = await queryRunner.hasColumn('custom_table_cell_styles', 'row_id');
    if (hasRowId) {
      await queryRunner.dropColumn('custom_table_cell_styles', 'row_id');
    }
  }
}
