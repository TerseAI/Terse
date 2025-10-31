// Re-export from shared utilities - single source of truth
export { formatIntegrationDisplay, type IntegrationInstance } from '../shared/IntegrationUtils';

// Re-export deprecated functions for backward compatibility
import {
  getIntegrationName,
  getIntegrationDescription
} from "./IntegrationUtils";

/**
 * Gets a short display name for an integration type
 * @deprecated Use getIntegrationName from IntegrationUtils instead
 */
export function getIntegrationTypeName(type: import("../types/Integration").Integration): string {
  return getIntegrationName(type);
}

/**
 * Gets a description for an integration type
 * @deprecated Use getIntegrationDescription from IntegrationUtils instead
 */
export function getIntegrationTypeDescription(type: import("../types/Integration").Integration): string {
  return getIntegrationDescription(type);
}
