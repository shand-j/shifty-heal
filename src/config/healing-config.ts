/**
 * Healing Configuration Management
 *
 * Supports multiple configuration sources: environment variables, config files, and programmatic API.
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { HealingConfig, HealingStrategy } from "../core/types";

/**
 * Load configuration from multiple sources (priority: programmatic > file > env)
 */
export function loadHealingConfig(
  overrides: Partial<HealingConfig> = {}
): HealingConfig {
  // Start with defaults
  let config: HealingConfig = getDefaultConfig();

  // Load from config file if exists
  const fileConfig = loadConfigFile();
  if (fileConfig) {
    config = mergeConfigs(config, fileConfig);
  }

  // Load from environment variables
  const envConfig = loadFromEnvironment();
  config = mergeConfigs(config, envConfig);

  // Apply programmatic overrides
  config = mergeConfigs(config, overrides);

  return config;
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): HealingConfig {
  return {
    enabled: true,
    strategies: [
      "data-testid-recovery",
      "text-content-matching",
      "css-hierarchy-analysis",
      "ai-powered-analysis",
    ],
    maxAttempts: 3,
    cacheHealing: true,
    ollama: {
      url: "http://localhost:11434",
      model: "qwen2.5-coder:3b",
      timeout: 30000,
    },
    retry: {
      onTimeout: true,
      onFlakiness: true,
      maxRetries: 2,
      initialBackoff: 1000,
    },
    telemetry: {
      enabled: true,
      logLevel: "info",
    },
  };
}

/**
 * Load configuration from file
 */
function loadConfigFile(): Partial<HealingConfig> | null {
  const possiblePaths = [
    resolve(process.cwd(), "healing.config.js"),
    resolve(process.cwd(), "healing.config.json"),
    resolve(process.cwd(), ".healingrc.js"),
    resolve(process.cwd(), ".healingrc.json"),
    resolve(process.cwd(), ".healingrc"),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      try {
        if (path.endsWith(".js")) {
          // Dynamic import for JS files
          const config = require(path);
          return config.default || config;
        } else {
          // Parse JSON files
          const content = readFileSync(path, "utf-8");
          return JSON.parse(content);
        }
      } catch (error) {
        console.warn(`Failed to load config from ${path}:`, error);
      }
    }
  }

  return null;
}

/**
 * Load configuration from environment variables
 */
function loadFromEnvironment(): Partial<HealingConfig> {
  const config: Partial<HealingConfig> = {};

  // Healing enabled
  if (process.env.HEALING_ENABLED !== undefined) {
    config.enabled = process.env.HEALING_ENABLED === "true";
  }

  // Strategies
  if (process.env.HEALING_STRATEGIES) {
    try {
      const strategies = process.env.HEALING_STRATEGIES.split(",").map((s) =>
        s.trim()
      ) as HealingStrategy[];
      config.strategies = strategies;
    } catch (error) {
      console.warn("Invalid HEALING_STRATEGIES format, using defaults");
    }
  }

  // Max attempts
  if (process.env.HEALING_MAX_ATTEMPTS) {
    const maxAttempts = parseInt(process.env.HEALING_MAX_ATTEMPTS);
    if (!isNaN(maxAttempts) && maxAttempts > 0) {
      config.maxAttempts = maxAttempts;
    }
  }

  // Cache healing
  if (process.env.HEALING_CACHE !== undefined) {
    config.cacheHealing = process.env.HEALING_CACHE === "true";
  }

  // Ollama configuration
  config.ollama = {};
  if (process.env.OLLAMA_URL) {
    config.ollama.url = process.env.OLLAMA_URL;
  }
  if (process.env.OLLAMA_MODEL) {
    config.ollama.model = process.env.OLLAMA_MODEL;
  }
  if (process.env.OLLAMA_TIMEOUT) {
    const timeout = parseInt(process.env.OLLAMA_TIMEOUT);
    if (!isNaN(timeout) && timeout > 0) {
      config.ollama.timeout = timeout;
    }
  }

  // Retry configuration
  config.retry = {};
  if (process.env.RETRY_ON_TIMEOUT !== undefined) {
    config.retry.onTimeout = process.env.RETRY_ON_TIMEOUT === "true";
  }
  if (process.env.RETRY_ON_FLAKINESS !== undefined) {
    config.retry.onFlakiness = process.env.RETRY_ON_FLAKINESS === "true";
  }
  if (process.env.MAX_RETRIES) {
    const maxRetries = parseInt(process.env.MAX_RETRIES);
    if (!isNaN(maxRetries) && maxRetries >= 0) {
      config.retry.maxRetries = maxRetries;
    }
  }
  if (process.env.INITIAL_BACKOFF) {
    const backoff = parseInt(process.env.INITIAL_BACKOFF);
    if (!isNaN(backoff) && backoff > 0) {
      config.retry.initialBackoff = backoff;
    }
  }

  // Telemetry configuration
  config.telemetry = {};
  if (process.env.TELEMETRY_ENABLED !== undefined) {
    config.telemetry.enabled = process.env.TELEMETRY_ENABLED === "true";
  }
  if (process.env.LOG_LEVEL) {
    const validLevels = ["debug", "info", "warn", "error"];
    if (validLevels.includes(process.env.LOG_LEVEL)) {
      config.telemetry.logLevel = process.env.LOG_LEVEL as any;
    }
  }

  return config;
}

/**
 * Merge two configurations (second takes precedence)
 */
function mergeConfigs(
  base: Partial<HealingConfig>,
  override: Partial<HealingConfig>
): HealingConfig {
  return {
    enabled: override.enabled ?? base.enabled ?? true,
    strategies: override.strategies ?? base.strategies ?? [],
    maxAttempts: override.maxAttempts ?? base.maxAttempts ?? 3,
    cacheHealing: override.cacheHealing ?? base.cacheHealing ?? true,
    ollama: {
      url: override.ollama?.url ?? base.ollama?.url ?? "http://localhost:11434",
      model: override.ollama?.model ?? base.ollama?.model ?? "qwen2.5-coder:3b",
      timeout: override.ollama?.timeout ?? base.ollama?.timeout ?? 30000,
    },
    retry: {
      onTimeout: override.retry?.onTimeout ?? base.retry?.onTimeout ?? true,
      onFlakiness:
        override.retry?.onFlakiness ?? base.retry?.onFlakiness ?? true,
      maxRetries: override.retry?.maxRetries ?? base.retry?.maxRetries ?? 2,
      initialBackoff:
        override.retry?.initialBackoff ?? base.retry?.initialBackoff ?? 1000,
    },
    telemetry: {
      enabled: override.telemetry?.enabled ?? base.telemetry?.enabled ?? true,
      logLevel:
        override.telemetry?.logLevel ?? base.telemetry?.logLevel ?? "info",
    },
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: HealingConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate strategies
  const validStrategies: HealingStrategy[] = [
    "data-testid-recovery",
    "text-content-matching",
    "css-hierarchy-analysis",
    "ai-powered-analysis",
  ];

  if (config.strategies) {
    for (const strategy of config.strategies) {
      if (!validStrategies.includes(strategy)) {
        errors.push(`Invalid strategy: ${strategy}`);
      }
    }
  }

  // Validate maxAttempts
  if (
    config.maxAttempts !== undefined &&
    (config.maxAttempts < 1 || config.maxAttempts > 10)
  ) {
    errors.push("maxAttempts must be between 1 and 10");
  }

  // Validate ollama timeout
  if (config.ollama?.timeout !== undefined && config.ollama.timeout < 1000) {
    errors.push("ollama.timeout must be at least 1000ms");
  }

  // Validate retry config
  if (config.retry?.maxRetries !== undefined && config.retry.maxRetries < 0) {
    errors.push("retry.maxRetries must be >= 0");
  }

  if (
    config.retry?.initialBackoff !== undefined &&
    config.retry.initialBackoff < 100
  ) {
    errors.push("retry.initialBackoff must be at least 100ms");
  }

  // Validate log level
  const validLogLevels = ["debug", "info", "warn", "error"];
  if (
    config.telemetry?.logLevel &&
    !validLogLevels.includes(config.telemetry.logLevel)
  ) {
    errors.push(`Invalid log level: ${config.telemetry.logLevel}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
