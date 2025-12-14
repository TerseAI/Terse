import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { settings } from './config/settings';
import { logs, Logger as OpenTelemetryLogger } from '@opentelemetry/api-logs';

const isDevelopment = settings.nodeEnv === 'development';
const usePostHog = !isDevelopment || settings.posthog.enableInDevelopment;

let sdk: NodeSDK | null = null;
let logRecordProcessor: BatchLogRecordProcessor | null = null;

// Lazy getter for OpenTelemetry logger - gets it when first needed
function getOpenTelemetryLogger(): OpenTelemetryLogger | null {
  if (!usePostHog) {
    return null;
  }
  try {
    return logs.getLogger(settings.posthog.serviceName || 'terse-backend');
  } catch (error) {
    console.error('[Logger] Failed to get OpenTelemetry logger:', error);
    return null;
  }
}

if (usePostHog) {
  try {
    const exporter = new OTLPLogExporter({
      url: 'https://us.i.posthog.com/i/v1/logs',
      headers: {
        'Authorization': `Bearer ${settings.posthog.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    logRecordProcessor = new BatchLogRecordProcessor(exporter, {
      maxQueueSize: 2048,
      scheduledDelayMillis: 5000,
      exportTimeoutMillis: 30000,
    });

    sdk = new NodeSDK({
      resource: resourceFromAttributes({
        'service.name': settings.posthog.serviceName || 'terse-backend',
        'service.version': process.env.npm_package_version || '1.0.0',
        'deployment.environment': settings.nodeEnv || 'development',
      }),
      logRecordProcessor: logRecordProcessor,
    });

    sdk.start();
  } catch (error) {
    console.error('[Logger] Failed to initialize PostHog logging:', error);
  }
}

// Graceful shutdown handler to flush logs
const gracefulShutdown = async () => {
  if (logRecordProcessor) {
    try {
      await logRecordProcessor.forceFlush();
      console.log('[Logger] Flushed pending logs to PostHog');
    } catch (error) {
      console.error('[Logger] Error flushing logs:', error);
    }
  }
  if (sdk) {
    try {
      await sdk.shutdown();
      console.log('[Logger] OpenTelemetry SDK shut down');
    } catch (error) {
      console.error('[Logger] Error shutting down SDK:', error);
    }
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('beforeExit', gracefulShutdown);




class Logger {
  private static instance: Logger;

  private constructor() { }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private logToConsole(level: string, message: string, attributes?: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    if (attributes && Object.keys(attributes).length > 0) {
      console.log(logMessage, attributes);
    } else {
      console.log(logMessage);
    }
  }

  private emitToPostHog(severityText: string, message: string, attributes?: Record<string, any>): void {
    const openTelemetryLogger = getOpenTelemetryLogger();
    
    if (!openTelemetryLogger) {
      // Fallback to console if PostHog is not initialized
      this.logToConsole(severityText, message, attributes);
      return;
    }
    try {
      // Map severity text to OpenTelemetry severity number
      const severityNumber = this.getSeverityNumber(severityText);
      
      // Flatten attributes - OpenTelemetry/PostHog expects primitive values
      // Stringify complex objects to avoid serialization issues
      const flattenedAttributes: Record<string, string | number | boolean> = {
        'log.level': severityText,
        'timestamp': new Date().toISOString(),
      };
      
      if (attributes) {
        for (const [key, value] of Object.entries(attributes)) {
          if (value === null || value === undefined) {
            continue; // Skip null/undefined values
          } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            flattenedAttributes[key] = value;
          } else {
            // Stringify complex objects/arrays
            try {
              flattenedAttributes[key] = JSON.stringify(value);
            } catch (e) {
              // If stringification fails, convert to string
              flattenedAttributes[key] = String(value);
            }
          }
        }
      }
      
      openTelemetryLogger.emit({
        severityNumber,
        severityText: severityText.toUpperCase(),
        body: message,
        attributes: flattenedAttributes,
      });
    } catch (error) {
      // Fallback to console if PostHog fails
      console.error('[Logger] Failed to emit log to PostHog:', error);
      this.logToConsole(severityText, message, attributes);
    }
  }

  private getSeverityNumber(severityText: string): number {
    const severityMap: Record<string, number> = {
      'trace': 1,
      'debug': 5,
      'info': 9,
      'warn': 13,
      'error': 17,
      'fatal': 21,
    };
    return severityMap[severityText.toLowerCase()] || 9; // Default to INFO
  }

  public async flush(): Promise<void> {
    if (logRecordProcessor) {
      try {
        await logRecordProcessor.forceFlush();
      } catch (error) {
        console.error('[Logger] Error flushing logs:', error);
      }
    }
  }

  private log(severityText: string, message: string, attributes?: Record<string, any>): void {
    if (usePostHog) {
      this.emitToPostHog(severityText, message, attributes);
    } else {
      this.logToConsole(severityText, message, attributes);
    }
  }

  public debug(message: string, attributes?: Record<string, any>): void {
    this.log('debug', message, attributes);
  }

  public info(message: string, attributes?: Record<string, any>): void {
    this.log('info', message, attributes);
  }

  public warn(message: string, attributes?: Record<string, any>): void {
    this.log('warn', message, attributes);
  }

  public error(message: string, attributes?: Record<string, any>): void {
    this.log('error', message, attributes);
  }
}

export default Logger.getInstance();