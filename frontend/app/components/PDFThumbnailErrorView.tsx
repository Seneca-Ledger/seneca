import { AlertCircle, FileText } from '@/app/components/icons';

interface PdfErrorViewProps {
  frameWidth: number;
  frameHeight: number;
  fallbackIconSize: number;
  errorMessage?: string;
}

/** What a thumbnail shows when its preview could not be loaded. */
export function PdfErrorView(props: PdfErrorViewProps): React.ReactElement {
  const { frameWidth, frameHeight, fallbackIconSize, errorMessage } = props;

  if (errorMessage) {
    return (
      <div
        style={{
          width: frameWidth,
          height: frameHeight,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          border: '1px solid var(--border-color)',
          borderRadius: 0,
          backgroundColor: 'var(--card-bg)',
          padding: 16,
          textAlign: 'center',
        }}
      >
        <AlertCircle
          data-testid="pdf-thumbnail-error-icon"
          size={24}
          style={{ color: 'var(--muted-foreground)' }}
        />
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)', margin: 0 }}>{errorMessage}</p>
      </div>
    );
  }

  return (
    <div
      style={{
        width: frameWidth,
        height: frameHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <FileText
        data-testid="pdf-thumbnail-fallback-icon"
        size={fallbackIconSize}
        style={{ color: 'var(--muted-foreground)' }}
      />
    </div>
  );
}
