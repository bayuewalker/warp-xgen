import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { ProviderOptionsByProvider } from "./models";

const createGatewayCalls: Array<Record<string, unknown>> = [];
const createOpenAICalls: Array<Record<string, unknown>> = [];

mock.module("ai", () => {
  const gateway = (modelId: string) => ({ modelId });

  return {
    createGateway: (settings?: Record<string, unknown>) => {
      createGatewayCalls.push(settings ?? {});
      return gateway;
    },
    defaultSettingsMiddleware: (_settings: unknown) => ({
      kind: "default-settings-middleware",
    }),
    gateway,
    wrapLanguageModel: ({ model }: { model: unknown }) => model,
  };
});

mock.module("@ai-sdk/openai", () => {
  const model = (modelId: string) => ({ modelId });
  return {
    createOpenAI: (settings?: Record<string, unknown>) => {
      createOpenAICalls.push(settings ?? {});
      return model;
    },
  };
});

mock.module("@ai-sdk/devtools", () => ({
  devToolsMiddleware: () => ({ kind: "devtools-middleware" }),
}));

const {
  gateway,
  getProviderOptionsForModel,
  mergeProviderOptions,
  shouldApplyOpenAIReasoningDefaults,
} = await import("./models");

const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;

beforeEach(() => {
  delete process.env.OPENROUTER_API_KEY;
  createOpenAICalls.length = 0;
});

afterEach(() => {
  if (originalOpenRouterApiKey === undefined) {
    delete process.env.OPENROUTER_API_KEY;
  } else {
    process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
  }
});

describe("shouldApplyOpenAIReasoningDefaults", () => {
  test("returns true for existing GPT-5 variants", () => {
    expect(shouldApplyOpenAIReasoningDefaults("openai/gpt-5.3")).toBe(true);
    expect(shouldApplyOpenAIReasoningDefaults("openai/gpt-5.4")).toBe(true);
  });

  test("returns true for future GPT-5 variants", () => {
    expect(shouldApplyOpenAIReasoningDefaults("openai/gpt-5.9")).toBe(true);
  });

  test("returns false for non-GPT-5 OpenAI models", () => {
    expect(shouldApplyOpenAIReasoningDefaults("openai/gpt-4o")).toBe(false);
  });
});

describe("getProviderOptionsForModel", () => {
  test("applies adaptive thinking defaults to Anthropic 4.6 models", () => {
    const result = getProviderOptionsForModel("anthropic/claude-sonnet-4.6");

    expect(result).toEqual({
      anthropic: {
        effort: "medium",
        thinking: { type: "adaptive" },
      },
    });
  });

  test("applies adaptive thinking defaults to Anthropic 4.7 models", () => {
    const result = getProviderOptionsForModel("anthropic/claude-opus-4.7");

    expect(result).toEqual({
      anthropic: {
        effort: "medium",
        thinking: { type: "adaptive" },
      },
    });
  });

  test("preserves legacy thinking defaults for older Anthropic models", () => {
    const result = getProviderOptionsForModel("anthropic/claude-opus-4.5");

    expect(result).toEqual({
      anthropic: {
        thinking: {
          type: "enabled",
          budgetTokens: 8000,
        },
      },
    });
  });

  test("merges OpenAI defaults with custom variant options", () => {
    const result = getProviderOptionsForModel("openai/gpt-5", {
      openai: {
        reasoningEffort: "medium",
      },
    });

    expect(result).toEqual({
      openai: {
        reasoningSummary: "detailed",
        include: ["reasoning.encrypted_content"],
        reasoningEffort: "medium",
        store: false,
      },
    });
  });

  test("applies low text verbosity defaults to GPT-5.4 snapshots", () => {
    const result = getProviderOptionsForModel("openai/gpt-5.4-2026-03-05");

    expect(result).toEqual({
      openai: {
        reasoningSummary: "detailed",
        include: ["reasoning.encrypted_content"],
        store: false,
        textVerbosity: "low",
      },
    });
  });

  test("preserves store false and encrypted reasoning content for the built-in GPT-5.4 variant", () => {
    const result = getProviderOptionsForModel("openai/gpt-5.4", {
      openai: {
        reasoningEffort: "xhigh",
        reasoningSummary: "auto",
      },
    });

    expect(result).toEqual({
      openai: {
        reasoningEffort: "xhigh",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
        store: false,
        textVerbosity: "low",
      },
    });
  });

  test("enforces store false for OpenAI models even when variant overrides it", () => {
    const result = getProviderOptionsForModel("openai/gpt-5", {
      openai: {
        store: true,
      },
    });

    expect(result).toEqual({
      openai: {
        reasoningSummary: "detailed",
        include: ["reasoning.encrypted_content"],
        store: false,
      },
    });
  });

  test("applies store false to non-GPT-5 OpenAI models", () => {
    const result = getProviderOptionsForModel("openai/gpt-4o");

    expect(result).toEqual({
      openai: {
        store: false,
      },
    });
  });

  test("strips provider-specific defaults when OPENROUTER_API_KEY is set", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";

    expect(getProviderOptionsForModel("anthropic/claude-sonnet-4.6")).toEqual(
      {},
    );
    expect(getProviderOptionsForModel("openai/gpt-5.4")).toEqual({});
    expect(getProviderOptionsForModel("openai/gpt-4o")).toEqual({});
  });

  test("preserves explicit caller overrides under OpenRouter", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";

    const result = getProviderOptionsForModel("anthropic/claude-sonnet-4.6", {
      openrouter: { reasoning: { effort: "high" } },
    });

    expect(result).toEqual({
      openrouter: { reasoning: { effort: "high" } },
    });
  });

  test("does not strip defaults when OPENROUTER_API_KEY is whitespace only", () => {
    process.env.OPENROUTER_API_KEY = "   ";

    expect(getProviderOptionsForModel("anthropic/claude-sonnet-4.6")).toEqual({
      anthropic: {
        effort: "medium",
        thinking: { type: "adaptive" },
      },
    });
  });
});

describe("mergeProviderOptions", () => {
  test("returns defaults when overrides are undefined", () => {
    const defaults: ProviderOptionsByProvider = {
      openai: {
        reasoningEffort: "high",
      },
    };

    expect(mergeProviderOptions(defaults)).toEqual(defaults);
  });

  test("deep merges nested provider options", () => {
    const defaults: ProviderOptionsByProvider = {
      anthropic: {
        thinking: {
          type: "enabled",
          budgetTokens: 8000,
        },
      },
    };

    const overrides: ProviderOptionsByProvider = {
      anthropic: {
        thinking: {
          budgetTokens: 4000,
        },
      },
    };

    expect(mergeProviderOptions(defaults, overrides)).toEqual({
      anthropic: {
        thinking: {
          type: "enabled",
          budgetTokens: 4000,
        },
      },
    });
  });

  test("adds provider overrides that do not exist in defaults", () => {
    const defaults: ProviderOptionsByProvider = {
      openai: {
        store: false,
      },
    };

    const overrides: ProviderOptionsByProvider = {
      anthropic: {
        effort: "low",
      },
    };

    expect(mergeProviderOptions(defaults, overrides)).toEqual({
      openai: {
        store: false,
      },
      anthropic: {
        effort: "low",
      },
    });
  });

  test("replaces arrays instead of deep-merging arrays", () => {
    const defaults: ProviderOptionsByProvider = {
      openai: {
        include: ["reasoning.encrypted_content"],
      },
    };

    const overrides: ProviderOptionsByProvider = {
      openai: {
        include: ["reasoning.summary"],
      },
    };

    expect(mergeProviderOptions(defaults, overrides)).toEqual({
      openai: {
        include: ["reasoning.summary"],
      },
    });
  });
});

describe("gateway attribution headers", () => {
  test("sends default warp-xgen attribution headers", () => {
    createGatewayCalls.length = 0;
    gateway("anthropic/claude-sonnet-4.6" as never);

    expect(createGatewayCalls).toEqual([
      {
        headers: {
          "http-referer": "https://warp-xgen.vercel.app",
          "x-title": "WARP-XGEN",
        },
      },
    ]);
  });

  test("allows overriding attribution via appName and appUrl", () => {
    createGatewayCalls.length = 0;
    gateway("anthropic/claude-sonnet-4.6" as never, {
      appName: "My App",
      appUrl: "https://myapp.com",
    });

    expect(createGatewayCalls).toEqual([
      {
        headers: {
          "http-referer": "https://myapp.com",
          "x-title": "My App",
        },
      },
    ]);
  });

  test("passes attribution headers with custom gateway config", () => {
    createGatewayCalls.length = 0;
    gateway("anthropic/claude-sonnet-4.6" as never, {
      config: { baseURL: "https://custom.api", apiKey: "sk-test" },
    });

    expect(createGatewayCalls).toEqual([
      {
        baseURL: "https://custom.api",
        apiKey: "sk-test",
        headers: {
          "http-referer": "https://warp-xgen.vercel.app",
          "x-title": "WARP-XGEN",
        },
      },
    ]);
  });
});

describe("gateway OpenRouter env switch", () => {
  test("routes through OpenRouter when OPENROUTER_API_KEY is set", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test-key";
    createGatewayCalls.length = 0;
    gateway("anthropic/claude-sonnet-4.6" as never);

    // OpenRouter path uses createOpenAI (not createGateway)
    expect(createGatewayCalls).toEqual([]);
    expect(createOpenAICalls).toEqual([
      {
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: "sk-or-test-key",
        headers: {
          "HTTP-Referer": "https://warp-xgen.vercel.app",
          "X-Title": "WARP-XGEN",
        },
        compatibility: "compatible",
      },
    ]);
  });

  test("trims surrounding whitespace from OPENROUTER_API_KEY", () => {
    process.env.OPENROUTER_API_KEY = "  sk-or-padded  ";
    createGatewayCalls.length = 0;
    gateway("anthropic/claude-sonnet-4.6" as never);

    expect(createOpenAICalls[0]).toMatchObject({
      apiKey: "sk-or-padded",
      baseURL: "https://openrouter.ai/api/v1",
    });
  });

  test("falls back to AI SDK defaults when OPENROUTER_API_KEY is unset", () => {
    delete process.env.OPENROUTER_API_KEY;
    createGatewayCalls.length = 0;
    gateway("anthropic/claude-sonnet-4.6" as never);

    expect(createGatewayCalls).toEqual([
      {
        headers: {
          "http-referer": "https://warp-xgen.vercel.app",
          "x-title": "WARP-XGEN",
        },
      },
    ]);
  });

  test("falls back to AI SDK defaults when OPENROUTER_API_KEY is empty or whitespace", () => {
    process.env.OPENROUTER_API_KEY = "   ";
    createGatewayCalls.length = 0;
    gateway("anthropic/claude-sonnet-4.6" as never);

    expect(createGatewayCalls).toEqual([
      {
        headers: {
          "http-referer": "https://warp-xgen.vercel.app",
          "x-title": "WARP-XGEN",
        },
      },
    ]);
  });

  test("explicit GatewayConfig wins over OPENROUTER_API_KEY env", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test-key";
    createGatewayCalls.length = 0;
    gateway("anthropic/claude-sonnet-4.6" as never, {
      config: { baseURL: "https://custom.api", apiKey: "sk-explicit" },
    });

    expect(createGatewayCalls).toEqual([
      {
        baseURL: "https://custom.api",
        apiKey: "sk-explicit",
        headers: {
          "http-referer": "https://warp-xgen.vercel.app",
          "x-title": "WARP-XGEN",
        },
      },
    ]);
  });
});
