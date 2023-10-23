import { expect } from "@open-wc/testing";
import { add } from "../src/calc";

describe("add", () => {
  it("should add two numbers", async () => {
    expect(add(40, 2)).equal(42);
  });
});

