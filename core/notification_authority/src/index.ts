export { NotificationAuthority, type NotificationAuthorityOptions } from './NotificationAuthority.js';
export { NotificationCategoryRegistry } from './categoryRegistry.js';
export { NotificationRegistry } from './registry.js';
export { RecipientRegistry, PRIORITY_RANK } from './recipientRegistry.js';
export { AcknowledgementManager } from './acknowledgementManager.js';
export { NotificationAuditTrail } from './auditTrail.js';
export { NotificationEventBus } from './events.js';
export { InstitutionalCommunicationIntelligence } from './intelligence.js';
export { checkSuppression } from './suppressionEngine.js';
export { findDueEscalationStep } from './escalationEngine.js';
export { computeDigestReport } from './digestManager.js';
export {
  ConsoleNotificationChannel,
  MemoryNotificationChannel,
  LogNotificationChannel,
  WebhookNotificationChannel,
  DiscordNotificationChannel,
  EmailNotificationChannel,
} from './channels.js';
export {
  NotificationAuthorityError,
  InvalidNotificationError,
  UnregisteredNotificationTypeError,
  DuplicateNotificationTypeError,
  UnregisteredNotificationCategoryError,
  NotificationNotFoundError,
  DuplicateChannelError,
  UnregisteredChannelError,
  RecipientNotFoundError,
  DigestNotFoundError,
} from './errors.js';
export {
  DEFAULT_NOTIFICATION_CATEGORIES,
  NOTIFICATION_EVENTS,
  type DefaultNotificationCategory,
  type NotificationSeverity,
  type NotificationPriority,
  type ChannelType,
  type DeliveryResult,
  type NotificationChannel,
  type EscalationAction,
  type EscalationStep,
  type EscalationPolicy,
  type RetentionPolicy,
  type SuppressionRuleSet,
  type NotificationDefinition,
  type NotificationInstanceStatus,
  type DeliveryAttempt,
  type NotificationRecord,
  type NotificationRequest,
  type Acknowledgement,
  type Recipient,
  type DigestDefinition,
  type DigestReport,
  type NotificationMetrics,
  type NotificationEventName,
  type ChannelReliability,
  type IgnoredNotificationType,
  type CommunicationInsights,
} from './types.js';
