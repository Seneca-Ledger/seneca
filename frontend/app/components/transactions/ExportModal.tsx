'use client';

import { useState } from 'react';
import { FileSpreadsheet, Table } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { ModalFooter, ModalShell } from '../ui/modal-shell';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (type: 'table' | 'excel' | 'csv') => void;
}

export default function ExportModal({ open, onClose, onExport }: ExportModalProps) {
  const [selectedType, setSelectedType] = useState<'table' | 'excel' | 'csv'>('table');
  const t = useIntlayer('exportModal');

  const handleConfirm = () => {
    onExport(selectedType);
    onClose();
  };

  return (
    <ModalShell
      isOpen={open}
      onClose={onClose}
      title={t.title.value}
      size="md"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleConfirm}
          confirmText={t.exportButton.value}
          cancelText={t.cancel.value}
        />
      }
    >
      <div className="seneca-export-modal">
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{t.description.value}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Export to Table */}
          <label
            className={`seneca-export-modal__option${selectedType === 'table' ? ' seneca-export-modal__option--selected' : ' seneca-export-modal__option--unselected'}`}
          >
            <input
              type="radio"
              name="export-type"
              value="table"
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                overflow: 'hidden',
                clip: 'rect(0,0,0,0)',
              }}
              checked={selectedType === 'table'}
              onChange={() => setSelectedType('table')}
            />
            <span className="seneca-export-modal__option-content">
              <span className="seneca-export-modal__option-title">
                <Table size={16} color="var(--primary)" />
                {t.exportToTable.value}
              </span>
              <span className="seneca-export-modal__option-desc">
                {t.exportToTableDescription.value}
              </span>
            </span>
            <span
              className={`seneca-export-modal__radio${selectedType === 'table' ? ' seneca-export-modal__radio--selected' : ''}`}
            >
              {selectedType === 'table' && (
                <span className="seneca-export-modal__radio-dot">
                  <span className="seneca-export-modal__radio-inner" />
                </span>
              )}
            </span>
          </label>

          {/* Export to Excel */}
          <label
            className={`seneca-export-modal__option${selectedType === 'excel' ? ' seneca-export-modal__option--selected' : ' seneca-export-modal__option--unselected'}`}
          >
            <input
              type="radio"
              name="export-type"
              value="excel"
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                overflow: 'hidden',
                clip: 'rect(0,0,0,0)',
              }}
              checked={selectedType === 'excel'}
              onChange={() => setSelectedType('excel')}
            />
            <span className="seneca-export-modal__option-content">
              <span className="seneca-export-modal__option-title">
                <FileSpreadsheet size={16} color="#16a34a" />
                Excel / CSV
              </span>
              <span className="seneca-export-modal__option-desc">{t.downloadFile.value}</span>
            </span>
            <span
              className={`seneca-export-modal__radio${selectedType === 'excel' ? ' seneca-export-modal__radio--selected' : ''}`}
            >
              {selectedType === 'excel' && (
                <span className="seneca-export-modal__radio-dot">
                  <span className="seneca-export-modal__radio-inner" />
                </span>
              )}
            </span>
          </label>
        </div>
      </div>
    </ModalShell>
  );
}
