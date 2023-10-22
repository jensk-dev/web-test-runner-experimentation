import { sendMessageWaitForResponse } from "/__web-dev-server__web-socket.js";
const PARAM_SESSION_ID = "wtr-session-id";
const sessionId = new URL(window.location.href).searchParams.get(
  PARAM_SESSION_ID,
);

console.log("sessionId", sessionId);

describe('', () => {
  it("asd", async () => {
    await sleep(2000);
  });
});

after(async () => {
  await sendMessageWaitForResponse({
    type: "wtr-command",
    sessionId,
    command: "stryker-report",
    payload: {
      mutantCoverage: globalThis?.__stryker__?.mutantCoverage,
    },
  });
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
