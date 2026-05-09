import { describe, expect, test } from "bun:test";
import { BUILT_IN_VARIANTS, type ModelVariant } from "@/lib/model-variants";
import { APP_DEFAULT_MODEL_ID } from "@/lib/models";
import { resolveChatModelSelection } from "./model-selection";

describe("resolveChatModelSelection", () => {
  test("returns direct model ids unchanged", () => {
    const selection = resolveChatModelSelection({
      selectedModelId: "openai/gpt-5",
      modelVariants: [],
      missingVariantLabel: "Selected model variant",
    });

    expect(selection).toEqual({
      id: "openai/gpt-5",
    });
  });

  test("resolves variant ids with provider options", () => {
    const modelVariants: ModelVariant[] = [
      {
        id: "variant:openai-medium",
        name: "OpenAI Medium",
        baseModelId: "openai/gpt-5",
        providerOptions: {
          reasoningEffort: "medium",
        },
      },
    ];

    const selection = resolveChatModelSelection({
      selectedModelId: "variant:openai-medium",
      modelVariants,
      missingVariantLabel: "Selected model variant",
    });

    expect(selection).toEqual({
      id: "openai/gpt-5",
      providerOptionsOverrides: {
        openai: {
          reasoningEffort: "medium",
          store: false,
        },
      },
    });
  });

  test("falls back to default when a built-in variant resolves to a disabled model", () => {
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };

    try {
      const selection = resolveChatModelSelection({
        selectedModelId: "variant:builtin:gpt-5.4-xhigh",
        modelVariants: BUILT_IN_VARIANTS,
        missingVariantLabel: "Selected model variant",
      });

      expect(selection).toEqual({
        id: APP_DEFAULT_MODEL_ID,
      });
      expect(warnings).toEqual([
        [
          'Selected model variant "variant:builtin:gpt-5.4-xhigh" resolves to disabled model "openai/gpt-5.4". Falling back to default model.',
        ],
      ]);
    } finally {
      console.warn = originalWarn;
    }
  });

  test("resolves built-in Anthropic variants", () => {
    const selection = resolveChatModelSelection({
      selectedModelId: "variant:builtin:claude-opus-4.6-high",
      modelVariants: BUILT_IN_VARIANTS,
      missingVariantLabel: "Selected model variant",
    });

    expect(selection).toEqual({
      id: "anthropic/claude-opus-4.6",
      providerOptionsOverrides: {
        anthropic: {
          effort: "high",
        },
      },
    });
  });

  test("falls back to the default model and warns when a variant is missing", () => {
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };

    try {
      const selection = resolveChatModelSelection({
        selectedModelId: "variant:missing",
        modelVariants: [],
        missingVariantLabel: "Selected model variant",
      });

      expect(selection).toEqual({
        id: APP_DEFAULT_MODEL_ID,
      });
      expect(warnings).toEqual([
        [
          'Selected model variant "variant:missing" was not found. Falling back to default model.',
        ],
      ]);
    } finally {
      console.warn = originalWarn;
    }
  });

  test("uses the default model when no model id is provided", () => {
    const selection = resolveChatModelSelection({
      selectedModelId: null,
      modelVariants: [],
      missingVariantLabel: "Selected model variant",
    });

    expect(selection).toEqual({
      id: APP_DEFAULT_MODEL_ID,
    });
  });
});
