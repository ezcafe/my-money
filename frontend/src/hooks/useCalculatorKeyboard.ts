/**
 * Calculator Keyboard Hook
 * Handles keyboard shortcuts for calculator operations
 */

import {useEffect, useRef} from 'react';

/**
 * Calculator keyboard handlers interface
 */
export interface CalculatorKeyboardHandlers {
  handleNumber: (num: string) => void;
  handleOperation: (op: string) => void;
  handleEquals: () => void;
  handleBackspace: () => void;
  handleClear: () => void;
}

/**
 * Hook for managing calculator keyboard shortcuts
 * @param handlers - Calculator operation handlers
 */
export function useCalculatorKeyboard(handlers: CalculatorKeyboardHandlers): void {
  // Use refs to access latest handlers without re-subscribing
  const handleNumberRef = useRef<((num: string) => void) | undefined>(undefined);
  const handleOperationRef = useRef<((op: string) => void) | undefined>(undefined);
  const handleEqualsRef = useRef<(() => void) | undefined>(undefined);
  const handleBackspaceRef = useRef<(() => void) | undefined>(undefined);
  const handleClearRef = useRef<(() => void) | undefined>(undefined);

  // Update refs when handlers change
  useEffect(() => {
    handleNumberRef.current = handlers.handleNumber;
    handleOperationRef.current = handlers.handleOperation;
    handleEqualsRef.current = handlers.handleEquals;
    handleBackspaceRef.current = handlers.handleBackspace;
    handleClearRef.current = handlers.handleClear;
  }, [handlers]);

  // Keyboard shortcuts for calculator
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Don't handle keyboard shortcuts when user is typing in an input field
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Handle number keys (0-9)
      if (event.key >= '0' && event.key <= '9') {
        event.preventDefault();
        handleNumberRef.current?.(event.key);
        return;
      }

      // Handle decimal point
      if (event.key === '.' || event.key === ',') {
        event.preventDefault();
        handleNumberRef.current?.('.');
        return;
      }

      // Handle operations
      if (event.key === '+') {
        event.preventDefault();
        handleOperationRef.current?.('+');
        return;
      }
      if (event.key === '-') {
        event.preventDefault();
        handleOperationRef.current?.('-');
        return;
      }
      if (event.key === '*') {
        event.preventDefault();
        handleOperationRef.current?.('*');
        return;
      }
      if (event.key === '/') {
        event.preventDefault();
        handleOperationRef.current?.('/');
        return;
      }

      // Handle equals/Enter
      if (event.key === '=' || event.key === 'Enter') {
        event.preventDefault();
        void handleEqualsRef.current?.();
        return;
      }

      // Handle backspace/Delete
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        handleBackspaceRef.current?.();
        return;
      }

      // Handle Escape to clear
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClearRef.current?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // Empty deps - handlers accessed via refs
}
