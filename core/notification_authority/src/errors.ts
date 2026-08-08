export class NotificationAuthorityError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'NotificationAuthorityError';
    this.code = code;
  }
}

export class InvalidNotificationError extends NotificationAuthorityError {
  constructor(reason: string) {
    super('NOTIFICATION_INVALID', `Invalid notification: ${reason}`);
    this.name = 'InvalidNotificationError';
  }
}

export class UnregisteredNotificationTypeError extends NotificationAuthorityError {
  constructor(notificationTypeId: string) {
    super('NOTIFICATION_UNREGISTERED_TYPE', `"${notificationTypeId}" is not a registered notification type.`);
    this.name = 'UnregisteredNotificationTypeError';
  }
}

export class DuplicateNotificationTypeError extends NotificationAuthorityError {
  constructor(notificationTypeId: string) {
    super('NOTIFICATION_DUPLICATE_TYPE', `Notification type "${notificationTypeId}" is already registered.`);
    this.name = 'DuplicateNotificationTypeError';
  }
}

export class UnregisteredNotificationCategoryError extends NotificationAuthorityError {
  constructor(category: string) {
    super('NOTIFICATION_UNREGISTERED_CATEGORY', `"${category}" is not a registered notification category.`);
    this.name = 'UnregisteredNotificationCategoryError';
  }
}

export class NotificationNotFoundError extends NotificationAuthorityError {
  constructor(notificationId: string) {
    super('NOTIFICATION_NOT_FOUND', `No notification "${notificationId}" is recorded.`);
    this.name = 'NotificationNotFoundError';
  }
}

export class DuplicateChannelError extends NotificationAuthorityError {
  constructor(channelType: string) {
    super('NOTIFICATION_DUPLICATE_CHANNEL', `Channel "${channelType}" is already registered.`);
    this.name = 'DuplicateChannelError';
  }
}

export class UnregisteredChannelError extends NotificationAuthorityError {
  constructor(channelType: string) {
    super('NOTIFICATION_UNREGISTERED_CHANNEL', `"${channelType}" is not a registered delivery channel.`);
    this.name = 'UnregisteredChannelError';
  }
}

export class RecipientNotFoundError extends NotificationAuthorityError {
  constructor(recipientId: string) {
    super('NOTIFICATION_RECIPIENT_NOT_FOUND', `No recipient "${recipientId}" is registered.`);
    this.name = 'RecipientNotFoundError';
  }
}

export class DigestNotFoundError extends NotificationAuthorityError {
  constructor(digestId: string) {
    super('NOTIFICATION_DIGEST_NOT_FOUND', `No digest "${digestId}" is registered.`);
    this.name = 'DigestNotFoundError';
  }
}
