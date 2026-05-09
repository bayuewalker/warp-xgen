import { describe, expect, test } from "bun:test";
import { APP_DEFAULT_MODEL_ID } from "./models";
import {
  filterDisabledModels,
  isModelDisabled,
  resolveAvailableModelId,
} from "./model-availability";

describe("isModelDisabled", () => {
  test("returns true for openai/gpt-5.4 (no OpenRouter equivalent)", () => {
    expect(isModelDisabled("openai/gpt-5.4")).toBe(true);
  });

  test("returns true for openai/gpt-5.4-pro", () => {
    expect(isModelDisabled("openai/gpt-5.4-pro")).toBe(true);
  });

  test("returns false for active models", () => {
    expect(isModelDisabled("anthropic/claude-sonnet-4.6")).toBe(false);
    expect(isModelDisabled("anthropic/claude-haiku-4.5")).toBe(false);
  });
});

describe("resolveAvailableModelId", () => {
  test("falls back to APP_DEFAULT_MODEL_ID for stale openai/gpt-5.4 prefs", () => {
    expect(resolveAvailableModelId("openai/gpt-5.4")).toBe(
      APP_DEFAULT_MODEL_ID,
    );
  });

  test("falls back to APP_DEFAULT_MODEL_ID for openai/gpt-5.4-pro", () => {
    expect(resolveAvailableModelId("openai/gpt-5.4-pro")).toBe(
      APP_DEFAULT_MODEL_ID,
    );
  });

  test("returns the requested ID when not disabled", () => {
    expect(resolveAvailableModelId("anthropic/claude-sonnet-4.6")).toBe(
      "anthropic/claude-sonnet-4.6",
    );
  });
});

describe("filterDisabledModels", () => {
  test("removes disabled models from the list", () => {
    const models = [
      { id: "anthropic/claude-sonnet-4.6" },
      { id: "openai/gpt-5.4" },
      { id: "anthropic/claude-haiku-4.5" },
      { id: "openai/gpt-5.4-pro" },
    ];

    expect(filterDisabledModels(models)).toEqual([
      { id: "anthropic/claude-sonnet-4.6" },
      { id: "anthropic/claude-haiku-4.5" },
    ]);
  });
});
