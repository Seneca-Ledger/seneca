import type { Statement } from '../../../entities/statement.entity';

/** The extension a statement's stored file is saved under. */
export function fileExtensionOf(statement: Statement): string {
  switch (statement.fileType) {
    case 'pdf':
      return 'pdf';
    case 'xlsx':
      return 'xlsx';
    case 'csv':
      return 'csv';
    case 'image':
      return 'jpg';
    case 'docx':
      return 'docx';
    default:
      return 'bin';
  }
}
