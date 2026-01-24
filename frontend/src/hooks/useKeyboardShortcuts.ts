/**
 * Keyboard Shortcuts Hook
 * Provides keyboard shortcut functionality for common actions
 */

import { useEffect, useCallback } from 'react';

/**
 * Keyboard shortcut configuration
 */
export interface KeyboardShortcut {
  /** Key combination (e.g., 'ctrl+k', 'escape') */
  key: string;
  /** Callback function to execute */
  handler: () => void;
  /** Whether to prevent default behavior */
  preventDefault?: boolean;
  /** Whether shortcut is enabled */
  enabled?: boolean;
}

/**
 * Parse keyboard shortcut string
 * @param shortcut - Shortcut string (e.g., 'ctrl+k', 'escape')
 * @returns Parsed key and modifiers
 */
function parseShortcut(shortcut: string): {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
} {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts[parts.length - 1]?.trim() ?? '';
  const ctrl = parts.includes('ctrl') || parts.includes('control');
  const shift = parts.includes('shift');
  const alt = parts.includes('alt');
  const meta = parts.includes('meta') || parts.includes('cmd');

  return { key, ctrl, shift, alt, meta };
}

/**
 * Check if keyboard event matches shortcut
 * @param event - Keyboard event
 * @param shortcut - Shortcut configuration
 * @returns Whether event matches shortcut
 */
function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  const parsed = parseShortcut(shortcut.key);
  const keyMatches =
    event.key.toLowerCase() === parsed.key || event.code.toLowerCase() === parsed.key;

  return (
    keyMatches &&
    event.ctrlKey === parsed.ctrl &&
    event.shiftKey === parsed.shift &&
    event.altKey === parsed.alt &&
    event.metaKey === parsed.meta
  );
}

/**
 * Keyboard Shortcuts Hook
 * Registers keyboard shortcuts and handles key events
 * @param shortcuts - Array of keyboard shortcut configurations
 * @param enabled - Whether shortcuts are enabled (default: true)
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true): void {
  /**
   * Handle keydown event
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) {
        return;
      }

      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) {
          continue;
        }

        if (matchesShortcut(event, shortcut)) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
            event.stopPropagation();
          }
          shortcut.handler();
          break;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    window.addEventListener('keydown', handleKeyDown);

    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
}
