import { createRequire } from "node:module";
import path from "node:path";

import {
  CoverageConfig,
  SESSION_STATUS,
  TestResult,
  TestRunner,
  TestRunnerCoreConfig,
  TestSuiteResult,
} from "@web/test-runner-core";
import { puppeteerLauncher } from "@web/test-runner-puppeteer";
import { esbuildPlugin } from "@web/dev-server-esbuild";
import {
  emulateMediaPlugin,
  selectOptionPlugin,
  setUserAgentPlugin,
  setViewportPlugin,
  sendKeysPlugin,
  filePlugin,
  snapshotPlugin,
  sendMousePlugin,
} from "@web/test-runner-commands/plugins";
import { nodeResolvePlugin } from "@web/dev-server";
import { getHtmlPath } from "@web/dev-server-core";
import { TestRunnerLogger } from "./logger.js";

const secondMs = 1000;
const minuteMs = secondMs * 60;

const defaultCoverageConfig: CoverageConfig = {
  exclude: ["**/node_modules/**/*", "**/web_modules/**/*"],
  threshold: { statements: 0, functions: 0, branches: 0, lines: 0 },
  report: true,
  reportDir: "coverage",
  reporters: ["lcov"],
};

const ROOT_DIR = process.cwd();

const require = createRequire(import.meta.url);
/**
 * The default values that are calculated when using `startWebTestRunner` without a config.
 * Only difference is the use of puppeteerLauncher instead of chromeLauncher.
 */
const testRunnerConfig: TestRunnerCoreConfig = {
  browsers: [puppeteerLauncher({ launchOptions: { headless: true } })],
  port: 8000,
  rootDir: ROOT_DIR,
  protocol: "http:",
  hostname: "localhost",
  middleware: [
    async (context, next) => {
      await next();
      if (context.path === "/" && typeof context.body === "string") {
        const testRunnerCommands = getHtmlPath(
          `./${path.relative(ROOT_DIR, require.resolve("@web/test-runner-commands"))}`,
        );
        context.body = context.body.replace(
          "</body>",
          `
          <script type="module">
          import { executeServerCommand } from '${testRunnerCommands}';
          const ns = globalThis.__stryker__ = globalThis.__stryker__ ?? {};

          // Example of test filtering:
          mocha.grep(/add/);

          // Grab currently executing test
          beforeEach(function() {
            ns.currentTestId = this.currentTest?.fullTitle();
          });
          after(async() => {
            // Report mutant coverage
            await executeServerCommand('stryker-report', {
              mutantCoverage: ns.mutantCoverage,

              // Also report the test file that was executed
              fileName: globalThis.__WTR_CONFIG__?.testFile
            });
          });
          </script>
          </body>`,
        );
        console.log(`👽 ${context.body}`);
      }
    },
  ],
  reporters: [],
  coverage: true,
  watch: false,
  concurrentBrowsers: 2,
  concurrency: 1,
  browserStartTimeout: minuteMs / 2,
  testsStartTimeout: secondMs * 20,
  testsFinishTimeout: minuteMs * 2,
  browserLogs: true,
  coverageConfig: defaultCoverageConfig,
  testFramework: {
    // eslint-disable-next-line unicorn/prefer-module
    path: require.resolve("@web/test-runner-mocha/dist/autorun.js"), // defaults when using `startWebTestRunner`
  },
  logger: new TestRunnerLogger(true),
  files: ["test/**/*.test.ts"],
  // default plugins used by @web/test-runner
  plugins: [
    {
      name: "stryker-hook",
      executeCommand(args) {
        if (args.command === "stryker-report") {
          console.log(
            "👽 Received mutation coverage:",
            JSON.stringify(args.payload),
          );
          return true;
        }
      },
    },
    esbuildPlugin({ ts: true }),
    setViewportPlugin(),
    emulateMediaPlugin(),
    setUserAgentPlugin(),
    selectOptionPlugin(),
    filePlugin(),
    sendKeysPlugin(),
    sendMousePlugin(),
    snapshotPlugin({ updateSnapshots: false }),
    // no-op stub to enable syntax checking
    {
      name: "syntax-checker",
      transformImport() {
        return undefined;
      },
    },
    nodeResolvePlugin(ROOT_DIR, false, undefined), // <-- required for node to resolve any dependencies used in the tests. In this case @open-wc/testing
  ],
};

let runs = 0;

// eslint-disable-next-line unicorn/prefer-top-level-await
(async () => {
  // eslint-disable-next-line no-debugger
  const runner = new TestRunner(testRunnerConfig);

  try {
    function stop() {
      runner.stop();
    }

    for (const event of ["exit", "SIGINT"] as NodeJS.Signals[]) {
      process.on(event, stop);
    }

    process.on("uncaughtException", (error) => {
      /* eslint-disable-next-line no-console */
      console.error(error);
      stop();
    });

    runner.on("stopped", (passed) => {
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(passed ? 0 : 1);
    });

    runner.on("finished", (passed) => {
      console.log(`successfully finished tests: ${passed}`);
      if (runs++ < 10) {
        const ids = [...runner.sessions.all()].map(({ id }) => id);
        console.log(ids);
        runner.runTests(runner.sessions.all());
        return;
      }
      stop();
    });

    runner.on("test-run-finished", (a) => {
      // gets called after each test run with the corresponding id and coverage ({ testRun, testCoverage }) => ...
      console.log("test-run-finished", a);
    });

    runner.sessions.on("session-status-updated", (session) => {
      if (session.errors.length > 0) {
        for (const err of session.errors) {
          // if there are any errors when starting the browser, log them
          console.error(err);
          console.error(session.logs);
        }
      } else if (session.status === SESSION_STATUS.FINISHED) {
        const suites = session.testResults?.suites;

        if (!suites) {
          return;
        }

        for (const suite of suites) {
          for (const test of suite.tests) {
            reportTestResult(test, suite);
          }
        }
      }
    });

    await runner.start();
  } catch (error) {
    console.error(error);

    setTimeout(() => {
      // exit after a timeout to allow CLI to flush console output
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(1);
    }, 0);
  }
})();

function reportTestResult(testResult: TestResult, suite: TestSuiteResult) {
  if (testResult.passed) {
    console.log(`✅ PASSED -> ${suite.name}.${testResult.name}`);
  } else {
    console.log(`❌ FAILED -> ${suite.name}.${testResult.name}`);
  }
}
