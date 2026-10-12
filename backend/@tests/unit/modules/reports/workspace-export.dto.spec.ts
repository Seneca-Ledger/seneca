import { WorkspaceExportBody } from '@/contracts';
import { WorkspaceExportFormat } from '@/modules/reports/dto/workspace-export.dto';
import { decodeBody, rejectedFields } from '../../../helpers/schema-body';

describe('WorkspaceExportBody', () => {
  it('accepts supported export formats', () => {
    const { value, errors } = decodeBody(WorkspaceExportBody, { format: WorkspaceExportFormat.DOCX });

    expect(errors).toHaveLength(0);
    expect(value?.format).toBe(WorkspaceExportFormat.DOCX);
  });

  it('falls back to Excel when no format is sent', () => {
    expect(decodeBody(WorkspaceExportBody, {}).value?.format).toBe(WorkspaceExportFormat.EXCEL);
  });

  it('rejects unknown export formats', () => {
    expect(rejectedFields(WorkspaceExportBody, { format: 'zip' })).toEqual(['format']);
  });
});
