import type { ConfigCategory, ConfigEntry } from './types.js';

/**
 * SSOT enforcement: every configuration key has exactly one registered owner.
 * Registering a duplicate id is a governance violation and throws.
 */
export class ConfigurationRegistry {
  private entries = new Map<string, ConfigEntry>();

  register(entry: ConfigEntry): void {
    if (this.entries.has(entry.id)) {
      throw new Error(
        `Configuration Authority violation: duplicate key "${entry.id}". Every configuration value has exactly one owner.`,
      );
    }
    this.entries.set(entry.id, entry);
  }

  registerAll(entries: ConfigEntry[]): void {
    for (const entry of entries) this.register(entry);
  }

  get(id: string): ConfigEntry | undefined {
    return this.entries.get(id);
  }

  require(id: string): ConfigEntry {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Unknown configuration key: "${id}"`);
    return entry;
  }

  byCategory(category: ConfigCategory): ConfigEntry[] {
    return [...this.entries.values()].filter((entry) => entry.category === category);
  }

  all(): ConfigEntry[] {
    return [...this.entries.values()];
  }

  ids(): string[] {
    return [...this.entries.keys()];
  }
}

/**
 * Master Configuration Authority registry (PHASE-02 §3, §6).
 *
 * Scope note (ADR-0006): only pure system-state values are registered here.
 * Conditional/operational rules (profitability thresholds, thermal/power limits,
 * schedules, auto-start/stop, failover behavior, hardware reservation *strategy*)
 * are deferred to the future Policy Authority per the Architect's Enhancement in
 * PHASE-02. See docs/phase-02/configuration-policy-boundary.md for the full mapping.
 */
export const DEFAULT_ENTRIES: ConfigEntry[] = [
  // ---- Platform ----
  {
    id: 'platform.name',
    category: 'platform',
    description: 'Platform name',
    dataType: 'string',
    defaultValue: 'IMIP',
    required: true,
    owner: 'Configuration Authority',
    runtimeMutability: 'immutable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'platform.version',
    category: 'platform',
    description: 'Platform version',
    dataType: 'string',
    defaultValue: '0.1.0',
    owner: 'Configuration Authority',
    runtimeMutability: 'immutable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'platform.runtimeMode',
    category: 'platform',
    description: 'Runtime mode',
    dataType: 'enum',
    enumValues: ['development', 'staging', 'production'],
    defaultValue: 'development',
    owner: 'Configuration Authority',
    runtimeMutability: 'authorized-update-only',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'platform.environment',
    category: 'platform',
    description: 'Deployment environment',
    dataType: 'enum',
    enumValues: ['local-pc', 'cloud', 'ci'],
    defaultValue: 'local-pc',
    owner: 'Configuration Authority',
    runtimeMutability: 'immutable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'platform.logLevel',
    category: 'platform',
    description: 'Logging level',
    dataType: 'enum',
    enumValues: ['debug', 'info', 'warn', 'error'],
    defaultValue: 'info',
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'platform.debugMode',
    category: 'platform',
    description: 'Debug mode',
    dataType: 'boolean',
    defaultValue: false,
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'platform.locale',
    category: 'platform',
    description: 'Locale',
    dataType: 'string',
    defaultValue: 'en-US',
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'platform.timezone',
    category: 'platform',
    description: 'Timezone',
    dataType: 'string',
    defaultValue: 'UTC',
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },

  // ---- Mining (system state only — see ADR-0006 for deferred policy values) ----
  {
    id: 'mining.enabled',
    category: 'mining',
    description: 'Enable mining subsystem',
    dataType: 'boolean',
    defaultValue: false,
    required: true,
    owner: 'Configuration Authority',
    runtimeMutability: 'authorized-update-only',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'mining.preferredMode',
    category: 'mining',
    description: 'Preferred mining mode',
    dataType: 'enum',
    enumValues: ['cpu', 'gpu', 'auto'],
    defaultValue: 'auto',
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'mining.idleTimeout',
    category: 'mining',
    description: 'Idle timeout in seconds before the mining subsystem reports idle',
    dataType: 'number',
    defaultValue: 300,
    range: { min: 0 },
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },

  // ---- Electricity ----
  {
    id: 'electricity.rate',
    category: 'electricity',
    description: 'Electricity rate',
    dataType: 'number',
    defaultValue: 0.12,
    range: { min: 0 },
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'electricity.currency',
    category: 'electricity',
    description: 'Electricity billing currency',
    dataType: 'string',
    defaultValue: 'USD',
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'electricity.billingModel',
    category: 'electricity',
    description: 'Electricity billing model',
    dataType: 'enum',
    enumValues: ['flat', 'time-of-use'],
    defaultValue: 'flat',
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'electricity.timeOfUseSchedule',
    category: 'electricity',
    description: 'Time-of-use pricing schedule',
    dataType: 'array',
    defaultValue: [],
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'electricity.peakPricing',
    category: 'electricity',
    description: 'Peak electricity pricing',
    dataType: 'number',
    defaultValue: 0.18,
    range: { min: 0 },
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'electricity.offPeakPricing',
    category: 'electricity',
    description: 'Off-peak electricity pricing',
    dataType: 'number',
    defaultValue: 0.08,
    range: { min: 0 },
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
    validate: (value, all) => {
      if (
        all['electricity.billingModel'] === 'time-of-use' &&
        typeof all['electricity.peakPricing'] === 'number' &&
        typeof value === 'number' &&
        value > (all['electricity.peakPricing'] as number)
      ) {
        return '"electricity.offPeakPricing" must not exceed "electricity.peakPricing" under a time-of-use billing model.';
      }
      return null;
    },
  },

  // ---- Hardware (allocation state only — limits/thresholds deferred to Policy, see ADR-0006) ----
  {
    id: 'hardware.reservedCpuCores',
    category: 'hardware',
    description: 'CPU cores reserved for mining',
    dataType: 'array',
    defaultValue: [],
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'hardware.reservedGpus',
    category: 'hardware',
    description: 'GPUs reserved for mining',
    dataType: 'array',
    defaultValue: [],
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },

  // ---- Pools (endpoints/ordering only — failover/retry policy deferred, see ADR-0006) ----
  {
    id: 'pools.endpoints',
    category: 'pools',
    description: 'Mining pool endpoints',
    dataType: 'array',
    defaultValue: [],
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'pools.backupPools',
    category: 'pools',
    description: 'Backup mining pool endpoints',
    dataType: 'array',
    defaultValue: [],
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'pools.poolPriorities',
    category: 'pools',
    description: 'Mining pool priority ordering',
    dataType: 'array',
    defaultValue: [],
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },

  // ---- Wallet ----
  {
    id: 'wallet.addresses',
    category: 'wallet',
    description: 'Wallet addresses (sensitive)',
    dataType: 'array',
    defaultValue: [],
    owner: 'Configuration Authority',
    runtimeMutability: 'authorized-update-only',
    versionIntroduced: '1.0.0',
    securityClassification: 'sensitive',
  },
  {
    id: 'wallet.payoutPreferences',
    category: 'wallet',
    description: 'Payout preferences (sensitive)',
    dataType: 'object',
    defaultValue: {},
    owner: 'Configuration Authority',
    runtimeMutability: 'authorized-update-only',
    versionIntroduced: '1.0.0',
    securityClassification: 'sensitive',
  },
  {
    id: 'wallet.minimumPayout',
    category: 'wallet',
    description: 'Minimum payout amount',
    dataType: 'number',
    defaultValue: 0.01,
    range: { min: 0 },
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'wallet.labels',
    category: 'wallet',
    description: 'Wallet labels',
    dataType: 'object',
    defaultValue: {},
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },

  // ---- AI ----
  {
    id: 'ai.enabled',
    category: 'ai',
    description: 'Enable AI augmentation',
    dataType: 'boolean',
    defaultValue: false,
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'ai.provider',
    category: 'ai',
    description: 'AI provider identifier',
    dataType: 'string',
    defaultValue: '',
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'ai.modelSelection',
    category: 'ai',
    description: 'Selected AI model',
    dataType: 'string',
    defaultValue: '',
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'ai.recommendationConfidenceThreshold',
    category: 'ai',
    description: 'Minimum confidence score for an AI recommendation to surface',
    dataType: 'number',
    defaultValue: 0.7,
    range: { min: 0, max: 1 },
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'ai.learningMode',
    category: 'ai',
    description: 'AI learning mode',
    dataType: 'enum',
    enumValues: ['online', 'offline', 'disabled'],
    defaultValue: 'disabled',
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
    validate: (value, all) => {
      if (value !== 'disabled' && all['ai.enabled'] !== true) {
        return '"ai.learningMode" cannot be non-disabled while "ai.enabled" is false.';
      }
      return null;
    },
  },
  {
    id: 'ai.historicalWindow',
    category: 'ai',
    description: 'AI historical training window, in days',
    dataType: 'number',
    defaultValue: 30,
    range: { min: 1 },
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },

  // ---- Dashboard ----
  {
    id: 'dashboard.refreshInterval',
    category: 'dashboard',
    description: 'Dashboard refresh interval, in milliseconds',
    dataType: 'number',
    defaultValue: 5000,
    range: { min: 250 },
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'dashboard.theme',
    category: 'dashboard',
    description: 'Dashboard theme',
    dataType: 'enum',
    enumValues: ['light', 'dark', 'system'],
    defaultValue: 'system',
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'dashboard.notificationPreferences',
    category: 'dashboard',
    description: 'Dashboard notification preferences',
    dataType: 'object',
    defaultValue: {},
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'dashboard.metricsDisplayed',
    category: 'dashboard',
    description: 'Metrics displayed on the dashboard',
    dataType: 'array',
    defaultValue: [],
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },

  // ---- Database ----
  {
    id: 'database.storageBackend',
    category: 'database',
    description: 'Database storage backend',
    dataType: 'enum',
    enumValues: ['postgres', 'sqlite', 'memory'],
    defaultValue: 'sqlite',
    required: true,
    owner: 'Configuration Authority',
    runtimeMutability: 'authorized-update-only',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'database.retentionPeriod',
    category: 'database',
    description: 'Data retention period, in days',
    dataType: 'number',
    defaultValue: 90,
    range: { min: 1 },
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'database.compression',
    category: 'database',
    description: 'Enable database compression',
    dataType: 'boolean',
    defaultValue: true,
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'database.backupInterval',
    category: 'database',
    description: 'Database backup interval, in hours',
    dataType: 'number',
    defaultValue: 24,
    range: { min: 1 },
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },

  // ---- Telemetry ----
  {
    id: 'telemetry.samplingInterval',
    category: 'telemetry',
    description: 'Telemetry sampling interval, in milliseconds',
    dataType: 'number',
    defaultValue: 1000,
    range: { min: 100 },
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'telemetry.metricsInterval',
    category: 'telemetry',
    description: 'Telemetry metrics publish interval, in milliseconds',
    dataType: 'number',
    defaultValue: 5000,
    range: { min: 100 },
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'telemetry.loggingPolicy',
    category: 'telemetry',
    description: 'Telemetry logging policy',
    dataType: 'enum',
    enumValues: ['verbose', 'standard', 'minimal'],
    defaultValue: 'standard',
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
  {
    id: 'telemetry.exportPolicy',
    category: 'telemetry',
    description: 'Telemetry export policy',
    dataType: 'enum',
    enumValues: ['disabled', 'local', 'remote'],
    defaultValue: 'disabled',
    owner: 'Configuration Authority',
    runtimeMutability: 'hot-reloadable',
    versionIntroduced: '1.0.0',
    securityClassification: 'public',
  },
];
