// Re-export from shared utilities - single source of truth
export {
  INTEGRATION_METADATA,
  getIntegrationInstances,
  getIntegrationName,
  getIntegrationDescription,
  getAllIntegrationMetadata,
  getAllInputIntegrationMetadata,
  getAllOutputIntegrationMetadata,
  formatIntegrationDisplay,
  isIntegrationInstance,
  type IntegrationMetadata,
  type IntegrationInstance,
} from '../shared/IntegrationUtils';
