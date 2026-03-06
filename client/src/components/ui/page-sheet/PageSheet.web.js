import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Drawer } from 'vaul';

const DESKTOP_BREAKPOINT = 768;
const SR_ONLY_STYLE = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]:not([aria-disabled="true"])',
  '[contenteditable="true"]',
].join(',');

function parseSnapPoint(snapPoint) {
  if (typeof snapPoint === 'number') {
    return Math.max(0, Math.min(1, snapPoint));
  }

  if (typeof snapPoint === 'string' && snapPoint.endsWith('%')) {
    const numeric = Number.parseFloat(snapPoint);
    if (Number.isFinite(numeric)) {
      return Math.max(0, Math.min(1, numeric / 100));
    }
  }

  return snapPoint;
}

function getFocusableElements(container) {
  if (!container || typeof container.querySelectorAll !== 'function') {
    return [];
  }

  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (node) => !node.hasAttribute('disabled') && node.getAttribute('aria-hidden') !== 'true'
  );
}

export default function PageSheet({
  open,
  onOpenChange,
  children,
  title,
  snapPoints,
  enablePanDownToClose = true,
  contentContainerStyle,
  testID,
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width > DESKTOP_BREAKPOINT;
  const contentRef = useRef(null);
  const previousOpenRef = useRef(open);
  const closeRequestedRef = useRef(false);
  const previousFocusRef = useRef(null);
  const [sessionKey, setSessionKey] = useState(open ? 1 : 0);

  const resolvedTitle = title || '팝업';
  const parsedSnapPoints = useMemo(
    () => (Array.isArray(snapPoints) && snapPoints.length > 0 ? snapPoints : ['90%']).map(parseSnapPoint),
    [snapPoints]
  );
  const flattenedContentStyle = useMemo(
    () => StyleSheet.flatten(contentContainerStyle) || undefined,
    [contentContainerStyle]
  );

  const requestClose = useCallback(() => {
    if (closeRequestedRef.current) {
      return;
    }

    closeRequestedRef.current = true;
    onOpenChange?.(false);
  }, [onOpenChange]);

  const restoreFocus = useCallback(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const previousFocus = previousFocusRef.current;
    if (previousFocus && typeof previousFocus.focus === 'function' && previousFocus.isConnected) {
      previousFocus.focus();
      return;
    }

    document.activeElement?.blur?.();
  }, []);

  useEffect(() => {
    if (open) {
      closeRequestedRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    const wasOpen = previousOpenRef.current;

    if (open && !wasOpen) {
      if (typeof document !== 'undefined') {
        previousFocusRef.current = document.activeElement;
      }
      setSessionKey((prev) => prev + 1);
    }

    if (!open && wasOpen) {
      restoreFocus();
    }

    previousOpenRef.current = open;
  }, [open, restoreFocus]);

  useEffect(() => {
    if (!open || !isDesktop) {
      return undefined;
    }

    const frame = requestAnimationFrame(() => {
      const container = contentRef.current;
      const focusables = getFocusableElements(container);
      const firstFocusable = focusables[0];

      if (firstFocusable && typeof firstFocusable.focus === 'function') {
        firstFocusable.focus();
      } else {
        container?.focus?.();
      }
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [isDesktop, open, sessionKey]);

  useEffect(() => {
    if (!open || !isDesktop || typeof document === 'undefined') {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (!contentRef.current) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        requestClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusables = getFocusableElements(contentRef.current);
      if (focusables.length === 0) {
        event.preventDefault();
        contentRef.current.focus?.();
        return;
      }

      const firstFocusable = focusables[0];
      const lastFocusable = focusables[focusables.length - 1];
      const activeElement = document.activeElement;
      const isInside = contentRef.current.contains(activeElement);

      if (event.shiftKey) {
        if (!isInside || activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable.focus();
        }
        return;
      }

      if (!isInside || activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isDesktop, open, requestClose]);

  const handleDrawerOpenChange = useCallback(
    (nextOpen) => {
      if (nextOpen) {
        onOpenChange?.(true);
        return;
      }

      requestClose();
    },
    [onOpenChange, requestClose]
  );

  if (!isDesktop) {
    return (
      <Drawer.Root
        open={open}
        onOpenChange={handleDrawerOpenChange}
        shouldScaleBackground
        snapPoints={parsedSnapPoints}
        dismissible={enablePanDownToClose}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Drawer.Content
            className="fixed bottom-0 left-0 right-0 z-40 mt-24 flex max-h-[96%] flex-col rounded-t-[10px] bg-white focus:outline-none"
            style={{ maxHeight: '96%' }}
            aria-describedby={undefined}
            data-testid={testID}
          >
            <Drawer.Title style={SR_ONLY_STYLE}>{resolvedTitle}</Drawer.Title>
            <Drawer.Description style={SR_ONLY_STYLE}>{resolvedTitle} 내용</Drawer.Description>

            <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-t-[10px] bg-white">
              <div className="my-4 h-1.5 w-12 flex-shrink-0 self-center rounded-full bg-gray-300" />
              <div
                key={sessionKey}
                className="flex-1 overflow-y-auto px-4 pb-8"
                style={flattenedContentStyle}
              >
                {children}
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  if (!open) {
    return null;
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={requestClose}
      testID={testID}
    >
      <Pressable onPress={requestClose} style={styles.backdrop}>
        <Pressable
          ref={contentRef}
          onPress={(event) => event.stopPropagation()}
          style={styles.desktopContent}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <View key={sessionKey} style={[styles.desktopInnerContent, contentContainerStyle]}>
            {children}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  desktopContent: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
  },
  desktopInnerContent: {
    flexGrow: 1,
  },
});
