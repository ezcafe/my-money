/**
 * Input sanitization utilities
 * Re-exports shared sanitization functions from @my-money/shared
 * This ensures consistent sanitization across frontend and backend
 */

export {
  sanitizeString,
  sanitizeObject,
  sanitizeUserInput,
  sanitizeFormInput,
} from '@my-money/shared';

