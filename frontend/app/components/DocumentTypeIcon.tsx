'use client';

import Image from 'next/image';
import { FileImage, FileSpreadsheet, FileText } from '@/app/components/icons';
import pdfIcon from '../../public/images/pdf.png';
import { PDFThumbnail } from './PDFThumbnail';

// eslint-disable-next-line max-params
const normalizeType = (fileType?: string, fileName?: string): string => {
  const type = (fileType || '').trim().toLowerCase();
  const name = (fileName || '').trim().toLowerCase();

  if (type) {
    return type;
  }

  const dot = name.lastIndexOf('.');
  if (dot === -1) {
    return '';
  }
  return name.slice(dot + 1);
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types, max-lines-per-function, complexity
export function DocumentTypeIcon(props: {
  fileType?: string;
  fileName?: string;
  fileId?: string;
  source?: 'statement' | 'gmail' | 'receipt';
  size?: number;
  className?: string;
  muted?: boolean;
}) {
  const size = props.size ?? 20;
  const type = normalizeType(props.fileType, props.fileName);

  const isPdf =
    type === 'pdf' || type.includes('pdf') || type.endsWith('/pdf') || type === 'application/pdf';
  if (isPdf) {
    // If fileId is provided, show thumbnail; otherwise show static icon
    if (props.fileId) {
      return (
        <PDFThumbnail
          fileId={props.fileId}
          fileName={props.fileName}
          source={props.source}
          size={size}
          className={props.className}
          muted={props.muted}
        />
      );
    }
    const pdfSize = Math.round((size || 20) * 2);
    return (
      <Image
        src={pdfIcon}
        alt="PDF"
        width={pdfSize}
        height={pdfSize}
        className={props.className}
        unoptimized
      />
    );
  }

  const isSpreadsheet =
    type === 'xlsx' ||
    type === 'xls' ||
    type === 'csv' ||
    type.includes('spreadsheet') ||
    type.includes('excel') ||
    type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    type === 'application/vnd.ms-excel' ||
    type === 'text/csv';
  if (isSpreadsheet) {
    return <FileSpreadsheet size={size} className={props.className} />;
  }

  const isImage =
    type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(type);
  if (isImage) {
    return <FileImage size={size} className={props.className} />;
  }

  return <FileText size={size} className={props.className} />;
}
