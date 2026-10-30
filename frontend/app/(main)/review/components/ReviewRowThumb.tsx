'use client';

import { DocumentThumbnailPreview } from '@/app/components/DocumentThumbnailPreview';
import { ItemThumb } from '@/app/components/item-images/ItemThumb';
import { payeeOf, type ReviewInboxDocument, type ReviewInboxItem } from '../lib/review-inbox-model';

interface ReviewRowThumbProps {
  item: ReviewInboxItem;
  document: ReviewInboxDocument | null;
  onOpen: (document: ReviewInboxDocument) => void;
}

/**
 * The square at the start of a Review row: the file the row came from, or —
 * for a row typed in by hand, such as a sale marked as received — the picture
 * of what was bought or sold.
 */
export function ReviewRowThumb({ item, document, onOpen }: ReviewRowThumbProps) {
  if (document) {
    return (
      <DocumentThumbnailPreview
        fileId={document.id}
        fileName={document.fileName ?? payeeOf(item)}
        fileType={
          document.source === 'receipt' ? 'pdf' : (document.fileType ?? document.fileName ?? '')
        }
        source={document.source}
        onOpen={() => onOpen(document)}
        testId={`review-thumbnail-${item.id}`}
      />
    );
  }
  const name = payeeOf(item);
  // "—" is someone else's private row: nothing to show, nothing to search for.
  if (item.kind !== 'transaction' || name === '—') {
    return null;
  }
  return <ItemThumb subject="transaction" id={item.id} name={name} />;
}
