/** Verbatim copy of TestRunnerLogger contained in @web/test-runner. For testing purposes only */

import { Logger, ErrorWithLocation } from '@web/test-runner-core';

export class TestRunnerLogger implements Logger {
  #isDebug = false;

  loggedSyntaxErrors = new Map<string, ErrorWithLocation[]>();

  constructor(isDebug: boolean) {
    this.#isDebug = isDebug;
  }

  log(...messages: unknown[]) {
    console.log(...messages);
  }

  debug(...messages: unknown[]) {
    if (this.#isDebug) {
      console.debug(...messages);
    }
  }

  error(...messages: unknown[]) {
    console.error(...messages);
  }

  warn(...messages: unknown[]) {
    console.warn(...messages);
  }

  group() {
    console.group();
  }

  groupEnd() {
    console.groupEnd();
  }

  logSyntaxError(error: ErrorWithLocation) {
    const { message, code, filePath, column, line } = error;
    let errors = this.loggedSyntaxErrors.get(filePath);
    if (!errors) {
      errors = [];
      this.loggedSyntaxErrors.set(filePath, errors);
    } else if (
      // eslint-disable-next-line unicorn/prefer-array-some
      errors.find(
        e => e.code === code && e.message === message && e.column === column && e.line === line,
      )
    ) {
      // dedupe syntax errors we already logged
      return;
    }
    errors.push(error);
  }

  clearLoggedSyntaxErrors() {
    this.loggedSyntaxErrors = new Map();
  }
}
