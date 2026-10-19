import { type RefObject, useEffect, useRef, useState } from 'react';

type ViewportResult = { viewportRef: RefObject<HTMLDivElement | null>; pageWidth: number };

export function useViewportWidth(isOpen: boolean): ViewportResult {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [pageWidth, setPageWidth] = useState(920);

  useEffect(() => {
    if (!(isOpen && viewportRef.current)) return;
    const node = viewportRef.current;
    const update = (): void => {
      setPageWidth(Math.max(520, Math.min(1080, Math.floor(node.clientWidth - 120))));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return (): void => {
      observer.disconnect();
    };
  }, [isOpen]);

  return { viewportRef, pageWidth };
}
