'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SourceImage } from '@/lib/composition';
import { ImageLoadError, firstImageFile, loadImage } from '@/lib/image';

/**
 * The three ways an image gets in: a drop, the file picker, and a paste.
 *
 * Paste is the one that matters most — screenshot, Cmd+V, done — so it is bound
 * to the window rather than to any focusable element.
 */
export function useImageInput() {
  const [image, setImage] = useState<SourceImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Kept in a ref so the paste handler can revoke the previous URL without
  // being torn down and rebound on every image change.
  const currentImage = useRef<SourceImage | null>(null);
  const dragDepth = useRef(0);

  const accept = useCallback(async (file: File | Blob | null | undefined) => {
    if (!file) return;
    try {
      const next = await loadImage(file);
      if (currentImage.current) URL.revokeObjectURL(currentImage.current.objectUrl);
      currentImage.current = next;
      setImage(next);
      setError(null);
    } catch (cause) {
      setError(cause instanceof ImageLoadError ? cause.message : 'That image could not be opened.');
    }
  }, []);

  const clear = useCallback(() => {
    if (currentImage.current) URL.revokeObjectURL(currentImage.current.objectUrl);
    currentImage.current = null;
    setImage(null);
    setError(null);
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = firstImageFile(event.clipboardData);
      if (!file) return;
      event.preventDefault();
      void accept(file);
    };

    // Without these, dropping anywhere outside the target makes the browser
    // navigate away from the app and lose the session.
    const onWindowDragOver = (event: DragEvent) => event.preventDefault();
    const onWindowDrop = (event: DragEvent) => event.preventDefault();

    window.addEventListener('paste', onPaste);
    window.addEventListener('dragover', onWindowDragOver);
    window.addEventListener('drop', onWindowDrop);

    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('dragover', onWindowDragOver);
      window.removeEventListener('drop', onWindowDrop);
    };
  }, [accept]);

  // Release the last object URL when the app unmounts.
  useEffect(
    () => () => {
      if (currentImage.current) URL.revokeObjectURL(currentImage.current.objectUrl);
    },
    [],
  );

  const dropHandlers = {
    onDragEnter: (event: React.DragEvent) => {
      event.preventDefault();
      dragDepth.current += 1;
      setIsDraggingOver(true);
    },
    onDragOver: (event: React.DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave: (event: React.DragEvent) => {
      event.preventDefault();
      // Entering a child fires dragleave on the parent; count depth so the
      // highlight only clears when the pointer really leaves.
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setIsDraggingOver(false);
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      dragDepth.current = 0;
      setIsDraggingOver(false);
      void accept(firstImageFile(event.dataTransfer));
    },
  };

  return { image, error, isDraggingOver, dropHandlers, accept, clear, setError };
}
