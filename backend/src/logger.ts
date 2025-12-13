import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { settings } from './config/settings';
import { logs } from '@opentelemetry/api-logs';

const isDevelopment = settings.nodeEnv === 'development';
let otelLogger: ReturnType<typeof logs.getLogger> | null = null;

// Initialize OpenTelemetry SDK only in non-development environments
if (!isDevelopment) {
  try {
    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        'service.name': settings.posthog.serviceName,
      }),
      logRecordProcessor: new BatchLogRecordProcessor(
        new OTLPLogExporter({
          url: 'https://us.i.posthog.com/i/v1/logs',
          headers: {
            'Authorization': `Bearer ${settings.posthog.apiKey}`
          }
        })
      )
    });

    sdk.start();
    otelLogger = logs.getLogger(settings.posthog.serviceName || 'terse-backend');
  } catch (error) {
    console.error('[Logger] Failed to initialize OpenTelemetry SDK:', error);
  }
}

class Logger {
  private static instance: Logger;

  private constructor() {}

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
    if (!otelLogger) return;

    try {
      otelLogger.emit({
        severityText,
        body: message,
        attributes: attributes || {},
      });
    } catch (error) {
      // Fallback to console if PostHog fails
      console.error('[Logger] Failed to emit log to PostHog:', error);
      this.logToConsole(severityText, message, attributes);
    }
  }

  private log(severityText: string, message: string, attributes?: Record<string, any>): void {
    if (isDevelopment) {
      this.logToConsole(severityText, message, attributes);
    } else {
      this.emitToPostHog(severityText, message, attributes);
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

const logger = Logger.getInstance();
export default logger;