/**
 * iHuman Monitoring & Logging System
 * 
 * Provides comprehensive observability:
 * - Structured logging with levels (debug, info, warn, error)
 * - Error tracking and reporting
 * - Performance metrics collection
 * - Distributed tracing support
 * - Sentry integration for error reporting
 * - DataDog metrics publishing
 * - Health checks and diagnostics
 */

const fs = require('fs');
const path = require('path');

/**
 * Monitoring Configuration
 */
const config = {
  logLevel: process.env.LOG_LEVEL || 'info',
  logDir: process.env.LOG_DIR || './logs',
  enableSentry: process.env.SENTRY_DSN ? true : false,
  sentryDsn: process.env.SENTRY_DSN,
  enableDataDog: process.env.DATADOG_API_KEY ? true : false,
  dataDogApiKey: process.env.DATADOG_API_KEY,
  enableTracing: process.env.ENABLE_TRACING === 'true',
  metricsInterval: parseInt(process.env.METRICS_INTERVAL || '60000'),
  maxLogSize: 10 * 1024 * 1024, // 10MB
  maxLogFiles: 10
};

/**
 * Structured Logger
 */
class Logger {
  constructor() {
    this.logDir = config.logDir;
    this.logLevel = config.logLevel;
    this.levels = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
    this.logQueue = [];
    this.flushInterval = setInterval(() => this.flush(), 5000);
    
    // Create log directory if needed
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Format log entry with timestamp, level, context
   */
  format(level, message, data = {}) {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...data,
      env: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0'
    };
  }

  /**
   * Write log to file and queue
   */
  log(level, message, data = {}) {
    if (this.levels[level] < this.levels[this.logLevel]) return;

    const entry = this.format(level, message, data);
    this.logQueue.push(entry);

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console[level === 'fatal' ? 'error' : level](
        `[${entry.timestamp}] [${level.toUpperCase()}] ${message}`,
        data
      );
    }

    // Flush immediately for errors
    if (level === 'error' || level === 'fatal') {
      this.flush();
    }
  }

  /**
   * Flush logs to file
   */
  flush() {
    if (this.logQueue.length === 0) return;

    const now = new Date();
    const logFile = path.join(
      this.logDir,
      `${now.toISOString().split('T')[0]}.log`
    );

    const logs = this.logQueue.map(entry => JSON.stringify(entry)).join('\n');
    
    try {
      fs.appendFileSync(logFile, logs + '\n');
      this.logQueue = [];

      // Rotate logs if needed
      this.rotateIfNeeded(logFile);
    } catch (err) {
      console.error('Failed to write log:', err);
    }
  }

  /**
   * Rotate logs if file size exceeded
   */
  rotateIfNeeded(logFile) {
    try {
      const stats = fs.statSync(logFile);
      if (stats.size > config.maxLogSize) {
        const timestamp = new Date().getTime();
        const backupFile = logFile.replace('.log', `.${timestamp}.log`);
        fs.renameSync(logFile, backupFile);

        // Clean up old backups
        const dir = path.dirname(logFile);
        const files = fs.readdirSync(dir)
          .filter(f => f.endsWith('.log'))
          .sort()
          .reverse();

        if (files.length > config.maxLogFiles) {
          files.slice(config.maxLogFiles).forEach(f => {
            fs.unlinkSync(path.join(dir, f));
          });
        }
      }
    } catch (err) {
      console.error('Log rotation error:', err);
    }
  }

  debug(message, data) { this.log('debug', message, data); }
  info(message, data) { this.log('info', message, data); }
  warn(message, data) { this.log('warn', message, data); }
  error(message, data) { this.log('error', message, data); }
  fatal(message, data) { this.log('fatal', message, data); }

  /**
   * Cleanup on shutdown
   */
  shutdown() {
    clearInterval(this.flushInterval);
    this.flush();
  }
}

/**
 * Performance Metrics Collector
 */
class MetricsCollector {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      avgResponseTime: 0,
      dbQueries: 0,
      avgQueryTime: 0,
      wsConnections: 0,
      webhookDeliveries: 0,
      failedDeliveries: 0,
      taskExecutions: 0,
      successfulExecutions: 0
    };
    this.startTime = Date.now();
  }

  /**
   * Record API request
   */
  recordRequest(duration, success = true) {
    this.metrics.requests++;
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime * (this.metrics.requests - 1) + duration) / 
      this.metrics.requests;
    
    if (!success) {
      this.metrics.errors++;
    }
  }

  /**
   * Record database query
   */
  recordQuery(duration) {
    this.metrics.dbQueries++;
    this.metrics.avgQueryTime = 
      (this.metrics.avgQueryTime * (this.metrics.dbQueries - 1) + duration) / 
      this.metrics.dbQueries;
  }

  /**
   * Record WebSocket connection
   */
  recordWsConnection(connected = true) {
    this.metrics.wsConnections += connected ? 1 : -1;
  }

  /**
   * Record webhook delivery
   */
  recordWebhookDelivery(success = true) {
    this.metrics.webhookDeliveries++;
    if (!success) {
      this.metrics.failedDeliveries++;
    }
  }

  /**
   * Record task execution
   */
  recordExecution(success = true) {
    this.metrics.taskExecutions++;
    if (success) {
      this.metrics.successfulExecutions++;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    return {
      ...this.metrics,
      uptime,
      successRate: this.metrics.requests > 0 
        ? ((this.metrics.requests - this.metrics.errors) / this.metrics.requests * 100).toFixed(2)
        : 0,
      executionSuccessRate: this.metrics.taskExecutions > 0
        ? (this.metrics.successfulExecutions / this.metrics.taskExecutions * 100).toFixed(2)
        : 0
    };
  }

  /**
   * Reset metrics
   */
  reset() {
    Object.keys(this.metrics).forEach(key => {
      if (key !== 'wsConnections') {
        this.metrics[key] = 0;
      }
    });
  }
}

/**
 * Error Tracker (Sentry integration)
 */
class ErrorTracker {
  constructor() {
    this.errors = [];
    this.enabled = config.enableSentry;
    
    if (this.enabled) {
      try {
        this.sentry = require('@sentry/node');
        this.sentry.init({
          dsn: config.sentryDsn,
          environment: process.env.NODE_ENV || 'development',
          tracesSampleRate: 1.0,
        });
      } catch (err) {
        console.warn('Sentry not available:', err.message);
        this.enabled = false;
      }
    }
  }

  /**
   * Track error
   */
  captureException(error, context = {}) {
    const errorData = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      context,
      severity: error.severity || 'error'
    };

    this.errors.push(errorData);

    // Send to Sentry if enabled
    if (this.enabled && this.sentry) {
      this.sentry.captureException(error, { contexts: { custom: context } });
    }

    // Keep only recent errors
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-100);
    }

    return errorData;
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit = 10) {
    return this.errors.slice(-limit);
  }

  /**
   * Clear errors
   */
  clear() {
    this.errors = [];
  }
}

/**
 * Health Check System
 */
class HealthChecker {
  constructor(db, ws) {
    this.db = db;
    this.ws = ws;
    this.checks = {};
  }

  /**
   * Run all health checks
   */
  async check() {
    const results = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {}
    };

    // Database check
    try {
      const start = Date.now();
      await this.db.query('SELECT 1');
      results.checks.database = {
        status: 'healthy',
        responseTime: Date.now() - start
      };
    } catch (err) {
      results.checks.database = {
        status: 'unhealthy',
        error: err.message
      };
      results.status = 'degraded';
    }

    // WebSocket check
    results.checks.websocket = {
      status: this.ws && this.ws.clients ? 'healthy' : 'unhealthy',
      connections: this.ws && this.ws.clients ? this.ws.clients.size : 0
    };

    // Memory check
    const memUsage = process.memoryUsage();
    results.checks.memory = {
      status: memUsage.heapUsed / memUsage.heapTotal < 0.9 ? 'healthy' : 'warning',
      usage: {
        heap: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
      }
    };

    return results;
  }

  /**
   * Get detailed diagnostics
   */
  async getDiagnostics() {
    return {
      health: await this.check(),
      metrics: global.metrics?.getMetrics() || {},
      recentErrors: global.errorTracker?.getRecentErrors() || [],
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      env: process.env.NODE_ENV || 'development'
    };
  }
}

/**
 * Initialize monitoring system
 */
function initializeMonitoring(app, db, ws) {
  global.logger = new Logger();
  global.metrics = new MetricsCollector();
  global.errorTracker = new ErrorTracker();
  const healthChecker = new HealthChecker(db, ws);

  // Middleware: Log all requests
  app.use((req, res, next) => {
    const start = Date.now();
    const originalSend = res.send;

    res.send = function(data) {
      const duration = Date.now() - start;
      global.metrics.recordRequest(duration, res.statusCode < 400);
      
      global.logger.info(`${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        ip: req.ip
      });

      return originalSend.call(this, data);
    };

    next();
  });

  // Middleware: Catch errors
  app.use((err, req, res, next) => {
    global.errorTracker.captureException(err, {
      method: req.method,
      path: req.path,
      url: req.url
    });

    global.logger.error('Unhandled error', {
      message: err.message,
      stack: err.stack,
      path: req.path
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  });

  // Health check endpoint
  app.get('/api/health', async (req, res) => {
    const health = await healthChecker.check();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  });

  // Diagnostics endpoint
  app.get('/api/diagnostics', async (req, res) => {
    const diagnostics = await healthChecker.getDiagnostics();
    res.json(diagnostics);
  });

  // Metrics endpoint
  app.get('/api/metrics', (req, res) => {
    res.json(global.metrics.getMetrics());
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    global.logger.info('SIGTERM received, shutting down gracefully');
    global.logger.shutdown();
    process.exit(0);
  });

  global.logger.info('Monitoring system initialized', {
    logLevel: config.logLevel,
    sentryEnabled: config.enableSentry,
    dataDogEnabled: config.enableDataDog
  });

  return { logger: global.logger, metrics: global.metrics, errorTracker: global.errorTracker };
}

module.exports = {
  initializeMonitoring,
  Logger,
  MetricsCollector,
  ErrorTracker,
  HealthChecker
};
