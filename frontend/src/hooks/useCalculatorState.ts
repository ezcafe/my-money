/**
 * Calculator State Hook
 * Manages calculator state and calculation handlers
 */

import { useState, useCallback } from 'react';

/**
 * Calculator state interface
 */
export interface CalculatorState {
  display: string;
  previousValue: number | null;
  operation: string | null;
  waitingForNewValue: boolean;
}

/**
 * Calculator state hook return type
 */
export interface UseCalculatorStateReturn {
  state: CalculatorState;
  showAmount: boolean;
  handleNumber: (num: string) => void;
  handleOperation: (op: string) => void;
  handleBackspace: () => void;
  handleTopUsedValueClick: (value: number) => void;
  handleEquals: () => number | null;
  getEffectiveAmount: () => number | null;
  reset: () => void;
  setShowAmount: (show: boolean) => void;
}

/**
 * Pure helper: compute result from calculator state without mutating.
 * @param display - Current display string
 * @param previousValue - Previous operand (if in expression)
 * @param operation - Current operation (if in expression)
 * @returns Computed result or null if invalid
 */
function computeResult(
  display: string,
  previousValue: number | null,
  operation: string | null
): number | null {
  const currentValue = parseFloat(display);

  if (previousValue !== null && operation) {
    switch (operation) {
      case '+':
        return previousValue + currentValue;
      case '-':
        return previousValue - currentValue;
      case '*':
        return previousValue * currentValue;
      case '/':
        return previousValue / currentValue;
      default:
        return currentValue;
    }
  }

  return currentValue;
}

/**
 * Hook for managing calculator state and operations
 * @returns Calculator state and handlers
 */
export function useCalculatorState(): UseCalculatorStateReturn {
  const [state, setState] = useState<CalculatorState>({
    display: '0',
    previousValue: null,
    operation: null,
    waitingForNewValue: false,
  });

  const [showAmount, setShowAmount] = useState<boolean>(false);

  /**
   * Handle number input
   */
  const handleNumber = useCallback((num: string) => {
    setShowAmount(true);
    setState((prev) => {
      if (prev.waitingForNewValue) {
        return {
          ...prev,
          display: num,
          waitingForNewValue: false,
        };
      }
      // Handle decimal point
      if (num === '.') {
        // Don't add decimal if one already exists
        if (prev.display.includes('.')) {
          return prev;
        }
        return {
          ...prev,
          display: prev.display === '0' ? '0.' : `${prev.display}.`,
        };
      }
      return {
        ...prev,
        display: prev.display === '0' ? num : prev.display + num,
      };
    });
  }, []);

  /**
   * Handle operation input
   */
  const handleOperation = useCallback((op: string) => {
    setShowAmount(true);
    setState((prev) => {
      const currentValue = parseFloat(prev.display);

      if (prev.previousValue === null) {
        return {
          ...prev,
          previousValue: currentValue,
          operation: op,
          waitingForNewValue: true,
        };
      }

      if (prev.operation) {
        let result: number;
        switch (prev.operation) {
          case '+':
            result = prev.previousValue + currentValue;
            break;
          case '-':
            result = prev.previousValue - currentValue;
            break;
          case '*':
            result = prev.previousValue * currentValue;
            break;
          case '/':
            result = prev.previousValue / currentValue;
            break;
          default:
            result = currentValue;
        }

        return {
          display: String(result),
          previousValue: op === '=' ? null : result,
          operation: op === '=' ? null : op,
          waitingForNewValue: op === '=' ? false : true,
        };
      }

      return {
        ...prev,
        operation: op,
        waitingForNewValue: true,
      };
    });
  }, []);

  /**
   * Handle backspace
   */
  const handleBackspace = useCallback(() => {
    setState((prev) => {
      // Current operand is already empty and we have an operation: remove the operation and show previousValue (e.g. "0 +" -> "0")
      if (
        prev.display === '' &&
        prev.previousValue !== null &&
        prev.operation
      ) {
        return {
          ...prev,
          display: String(prev.previousValue),
          previousValue: null,
          operation: null,
          waitingForNewValue: false,
        };
      }

      // Remove last character from current operand
      const newDisplay = prev.display.slice(0, -1);

      // Result is empty or only minus
      if (newDisplay === '' || newDisplay === '-') {
        // Mid-expression: keep amount visible, show "prev op " (empty current operand)
        if (prev.previousValue !== null && prev.operation) {
          return {
            ...prev,
            display: '',
          };
        }
        // Single number: hide and reset to '0'
        setShowAmount(false);
        return {
          ...prev,
          display: '0',
        };
      }

      return {
        ...prev,
        display: newDisplay,
      };
    });
  }, []);

  /**
   * Handle top used value button click
   * Sets the calculator display to the selected value
   */
  const handleTopUsedValueClick = useCallback((value: number) => {
    setShowAmount(true);
    setState((prev) => ({
      ...prev,
      display: String(value),
      waitingForNewValue: false,
    }));
  }, []);

  /**
   * Get effective amount (calculated result) without mutating state.
   * When display shows an operation (e.g. 10 + 5), returns the computed result (15).
   * @returns Effective amount or null if invalid
   */
  const getEffectiveAmount = useCallback((): number | null => {
    const result = computeResult(
      state.display,
      state.previousValue,
      state.operation
    );
    if (
      result === null ||
      Number.isNaN(result) ||
      !Number.isFinite(result) ||
      result <= 0
    ) {
      return null;
    }
    return result;
  }, [state.display, state.previousValue, state.operation]);

  /**
   * Handle equals - calculates result and returns it
   * @returns Calculated result or null if invalid
   */
  const handleEquals = useCallback((): number | null => {
    let result: number | null = null;

    setState((prev) => {
      result = computeResult(prev.display, prev.previousValue, prev.operation);

      if (result === null || Number.isNaN(result) || !Number.isFinite(result)) {
        return prev;
      }

      return {
        display: String(result),
        previousValue: null,
        operation: null,
        waitingForNewValue: false,
      };
    });

    return result;
  }, []);

  /**
   * Reset calculator state
   */
  const reset = useCallback(() => {
    setState({
      display: '0',
      previousValue: null,
      operation: null,
      waitingForNewValue: false,
    });
    setShowAmount(false);
  }, []);

  return {
    state,
    showAmount,
    handleNumber,
    handleOperation,
    handleBackspace,
    handleTopUsedValueClick,
    handleEquals,
    getEffectiveAmount,
    reset,
    setShowAmount,
  };
}
