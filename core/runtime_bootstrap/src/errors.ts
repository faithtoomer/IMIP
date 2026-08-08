export class RuntimeOrchestratorError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RuntimeOrchestratorError';
    this.code = code;
  }
}

export class DuplicateComponentError extends RuntimeOrchestratorError {
  constructor(name: string) {
    super('RUNTIME_DUPLICATE_COMPONENT', `Component "${name}" is already registered.`);
    this.name = 'DuplicateComponentError';
  }
}

export class MissingDependencyError extends RuntimeOrchestratorError {
  constructor(component: string, missing: string[]) {
    super('RUNTIME_MISSING_DEPENDENCY', `Component "${component}" depends on unregistered component(s): ${missing.join(', ')}.`);
    this.name = 'MissingDependencyError';
  }
}

export class CircularDependencyError extends RuntimeOrchestratorError {
  constructor(cycle: string[]) {
    super('RUNTIME_CIRCULAR_DEPENDENCY', `Circular dependency detected: ${cycle.join(' -> ')}.`);
    this.name = 'CircularDependencyError';
  }
}

/** Law 6 — partial startup is prohibited unless explicitly authorized by policy. */
export class BootstrapFailedError extends RuntimeOrchestratorError {
  readonly failures: { component: string; message: string }[];

  constructor(failures: { component: string; message: string }[]) {
    super('RUNTIME_BOOTSTRAP_FAILED', `Bootstrap failed for: ${failures.map((f) => f.component).join(', ')}.`);
    this.name = 'BootstrapFailedError';
    this.failures = failures;
  }
}

export class CertificationFailedError extends RuntimeOrchestratorError {
  readonly reasons: string[];

  constructor(reasons: string[]) {
    super('RUNTIME_CERTIFICATION_FAILED', `Runtime certification failed: ${reasons.join('; ')}`);
    this.name = 'CertificationFailedError';
    this.reasons = reasons;
  }
}

export class InvalidLifecycleTransitionError extends RuntimeOrchestratorError {
  constructor(from: string, to: string) {
    super('RUNTIME_ILLEGAL_TRANSITION', `Illegal runtime lifecycle transition: "${from}" -> "${to}".`);
    this.name = 'InvalidLifecycleTransitionError';
  }
}

export class ComponentNotFoundError extends RuntimeOrchestratorError {
  constructor(name: string) {
    super('RUNTIME_COMPONENT_NOT_FOUND', `No component named "${name}" is registered.`);
    this.name = 'ComponentNotFoundError';
  }
}
