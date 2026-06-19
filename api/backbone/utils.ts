import { v4 as uuidv4 } from 'uuid';
import { WorkloadLevel } from './types';

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}-${uuidv4().slice(0, 8)}`;
}

export function resolveCorrelationId(correlationId?: string): string {
  return correlationId && correlationId.trim() ? correlationId : `corr-${uuidv4().slice(0, 8)}`;
}

export function normalizeBlockers(input?: string | string[] | null): string[] {
  if (input === undefined || input === null) return [];
  if (Array.isArray(input)) {
    return input
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  const value = input.trim();
  return value ? [value] : [];
}

export function normalizeNeedsHelp(input?: boolean | null): boolean {
  if (input === undefined || input === null) return false;
  if (typeof input !== 'boolean') {
    throw new Error('needsHelp must be a boolean when provided');
  }
  return input;
}

export function assertWorkload(value: string): asserts value is WorkloadLevel {
  if (value !== 'light' && value !== 'normal' && value !== 'heavy') {
    throw new Error('workload must be one of: light, normal, heavy');
  }
}

export function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
