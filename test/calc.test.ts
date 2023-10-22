import { expect } from "@open-wc/testing";
import { add } from "../src/calc";

describe("add", () => {
  it("should add two numbers", async () => {
    await sleep(2000);
    expect(add(40, 2)).equal(42);
  });
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
