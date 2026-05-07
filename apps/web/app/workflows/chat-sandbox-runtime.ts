import { discoverSkills } from "@open-agents/agent";
import {
  connectSandbox,
  type Sandbox,
  type SandboxState,
} from "@open-agents/sandbox";
import type { UIMessageChunk } from "ai";
import { getWritable } from "workflow";
import type { WebAgentWorkspaceStatusData } from "@/app/types";
import { getSessionById, updateSession } from "@/lib/db/sessions";
import {
  verifyRepoAccess,
  getRepoAccessErrorMessage,
} from "@/lib/github/access";
import {
  mintInstallationToken,
  revokeInstallationToken,
  type ScopedInstallationToken,
} from "@/lib/github/app";
import { getGitHubUserProfile } from "@/lib/github/users";
import {
  buildActiveLifecycleUpdate,
  getNextLifecycleVersion,
} from "@/lib/sandbox/lifecycle";
import { kickSandboxLifecycleWorkflow } from "@/lib/sandbox/lifecycle-kick";
import {
  DEFAULT_SANDBOX_BASE_SNAPSHOT_ID,
  DEFAULT_SANDBOX_PORTS,
  DEFAULT_SANDBOX_TIMEOUT_MS,
} from "@/lib/sandbox/config";
import {
  getResumableSandboxName,
  getSessionSandboxName,
  isSandboxActive,
} from "@/lib/sandbox/utils";
import { getSandboxSkillDirectories } from "@/lib/skills/directories";
import { installGlobalSkills } from "@/lib/skills/global-skill-installer";
import { getCachedSkills, setCachedSkills } from "@/lib/skills-cache";

type SessionRecord = NonNullable<Awaited<ReturnType<typeof getSessionById>>>;
type DiscoveredSkills = Awaited<ReturnType<typeof discoverSkills>>;

export type ResolvedChatSandboxRuntime = {
  sandboxState: SandboxState;
  workingDirectory: string;
  currentBranch?: string;
  environmentDetails?: string;
  skills: DiscoveredSkills;
  didSetupWorkspace: boolean;
  sessionTitle: string;
  repoOwner?: string;
  repoName?: string;
};

function isSandboxState(value: unknown): value is SandboxState {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "vercel"
  );
}

function buildSandboxSource(session: SessionRecord): SandboxState["source"] {
  if (!session.cloneUrl) {
    return undefined;
  }

  const branchExistsOnOrigin = session.prNumber != null;
  const shouldCreateNewBranch = session.isNewBranch && !branchExistsOnOrigin;

  return {
    repo: session.cloneUrl,
    ...(shouldCreateNewBranch
      ? { newBranch: session.branch ?? undefined }
      : { branch: session.branch ?? "main" }),
  };
}

function buildSandboxState(session: SessionRecord): SandboxState {
  const existingState = session.sandboxState;
  const sandboxName =
    getResumableSandboxName(existingState) ?? getSessionSandboxName(session.id);
  const source = buildSandboxSource(session);

  return {
    type: "vercel",
    ...(isSandboxState(existingState) ? existingState : {}),
    sandboxName,
    ...(source ? { source } : {}),
  };
}

async function getGitUser(userId: string) {
  const profile = await getGitHubUserProfile(userId);
  const githubNoreplyEmail =
    profile?.externalUserId && profile.username
      ? `${profile.externalUserId}+${profile.username}@users.noreply.github.com`
      : undefined;

  return {
    name: profile?.username ?? "Open Harness",
    email: githubNoreplyEmail ?? `${userId}@users.noreply.github.com`,
  };
}

async function installSessionGlobalSkills(params: {
  session: SessionRecord;
  sandbox: Sandbox;
  didSetupWorkspace: boolean;
}): Promise<void> {
  if (!params.didSetupWorkspace) {
    return;
  }

  const globalSkillRefs = params.session.globalSkillRefs ?? [];
  if (globalSkillRefs.length === 0) {
    return;
  }

  try {
    await installGlobalSkills({
      sandbox: params.sandbox,
      globalSkillRefs,
    });
  } catch (error) {
    console.error(
      `Failed to install global skills for session ${params.session.id}:`,
      error,
    );
  }
}

async function loadSessionSkills(params: {
  sessionId: string;
  sandboxState: SandboxState;
  sandbox: Sandbox;
}): Promise<DiscoveredSkills> {
  const cachedSkills = await getCachedSkills(
    params.sessionId,
    params.sandboxState,
  );
  if (cachedSkills !== null) {
    return cachedSkills;
  }

  const skillDirs = await getSandboxSkillDirectories(params.sandbox);
  const discoveredSkills = await discoverSkills(params.sandbox, skillDirs);
  await setCachedSkills(
    params.sessionId,
    params.sandboxState,
    discoveredSkills,
  );
  return discoveredSkills;
}

async function sendWorkspaceStatus(data: WebAgentWorkspaceStatusData) {
  const writer = getWritable<UIMessageChunk>().getWriter();
  try {
    await writer.write({
      type: "data-workspace-status",
      id: "workspace-status",
      data,
      transient: true,
    });
  } finally {
    writer.releaseLock();
  }
}

async function sendStart(messageId: string) {
  const writer = getWritable<UIMessageChunk>().getWriter();
  try {
    await writer.write({ type: "start", messageId });
  } finally {
    writer.releaseLock();
  }
}

export async function resolveChatSandboxRuntime(params: {
  userId: string;
  sessionId: string;
  assistantId: string;
}): Promise<ResolvedChatSandboxRuntime> {
  "use step";

  await sendStart(params.assistantId);

  const session = await getSessionById(params.sessionId);
  if (!session) {
    throw new Error("Session not found");
  }
  if (session.userId !== params.userId) {
    throw new Error("Unauthorized");
  }
  if (session.status === "archived") {
    throw new Error("Session is archived");
  }

  const didSetupWorkspace = !isSandboxActive(session.sandboxState);
  if (didSetupWorkspace) {
    await sendWorkspaceStatus({
      status: "setting-up",
      message: "Setting up the workspace...",
    });
  }

  const gitUser = await getGitUser(params.userId).catch((e) => {
    console.error("[debug] getGitUser failed:", e);
    throw new Error(`getGitUser failed: ${e?.name}: ${e?.message}`, { cause: e });
  });
  let setupToken: ScopedInstallationToken | undefined;

  if (session.cloneUrl) {
    if (!session.repoOwner || !session.repoName) {
      throw new Error("Session is missing repository metadata");
    }

    const access = await verifyRepoAccess({
      userId: params.userId,
      owner: session.repoOwner,
      repo: session.repoName,
    }).catch((e) => {
      console.error("[debug] verifyRepoAccess failed:", e);
      throw new Error(`verifyRepoAccess failed: ${e?.name}: ${e?.message}`, { cause: e });
    });
    if (!access.ok) {
      throw new Error(getRepoAccessErrorMessage(access.reason));
    }

    setupToken = await mintInstallationToken({
      installationId: access.installationId,
      repositoryIds: [access.repositoryId],
      permissions: { contents: "read" },
    }).catch((e) => {
      console.error("[debug] mintInstallationToken failed:", e);
      throw new Error(`mintInstallationToken failed: ${e?.name}: ${e?.message}`, { cause: e });
    });
  }

  let sandbox: Sandbox;
  // DEBUG: Intercept global fetch to capture Vercel Sandbox API request/response
  const originalFetch = globalThis.fetch;
  type VercelReq = { url: string; method: string; body?: string };
  type VercelResp = { status: number; body: string };
  let lastVercelRequest: VercelReq | null = null;
  let lastVercelResponse: VercelResp | null = null;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const isVercel = url.includes("vercel.com") || url.includes("vercel.app/api");
    if (isVercel) {
      lastVercelRequest = {
        url,
        method: init?.method || (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET"),
        body: typeof init?.body === "string" ? init.body.slice(0, 2000) : undefined,
      };
    }
    const resp = await originalFetch(input, init);
    if (isVercel && !resp.ok) {
      const cloned = resp.clone();
      const body = await cloned.text().catch(() => "<unreadable>");
      lastVercelResponse = { status: resp.status, body: body.slice(0, 2000) };
      console.error("[debug] vercel api error response:", { url, status: resp.status, body: body.slice(0, 2000) });
    }
    return resp;
  }) as typeof fetch;

  try {
    console.log("[debug] connectSandbox starting", {
      hasGithubToken: !!setupToken?.token,
      baseSnapshotId: DEFAULT_SANDBOX_BASE_SNAPSHOT_ID,
      hasSource: !!buildSandboxSource(session),
      hasVercelToken: !!process.env.VERCEL_ACCESS_TOKEN,
      hasVercelTeamId: !!process.env.VERCEL_TEAM_ID,
      hasVercelProjectId: !!process.env.VERCEL_PROJECT_ID,
      hasVercelOidcToken: !!process.env.VERCEL_OIDC_TOKEN,
    });
    sandbox = await connectSandbox({
      state: buildSandboxState(session),
      options: {
        githubToken: setupToken?.token,
        gitUser,
        timeout: DEFAULT_SANDBOX_TIMEOUT_MS,
        ports: DEFAULT_SANDBOX_PORTS,
        baseSnapshotId: DEFAULT_SANDBOX_BASE_SNAPSHOT_ID,
        persistent: true,
        resume: true,
        createIfMissing: true,
      },
    });
  } catch (e) {
    const err = e as Error & { response?: unknown; body?: unknown; status?: number; statusCode?: number };
    console.error("[debug] connectSandbox failed:", err);
    console.error("[debug] connectSandbox error props:", {
      name: err?.name,
      message: err?.message,
      status: err?.status,
      statusCode: err?.statusCode,
      response: err?.response,
      body: err?.body,
      cause: err?.cause,
      stack: err?.stack,
    });
    console.error("[debug] last vercel api request:", lastVercelRequest);
    console.error("[debug] last vercel api error response:", lastVercelResponse);
    const reqInfo = lastVercelRequest
      ? ` | req=${lastVercelRequest.method} ${lastVercelRequest.url.replace(/^https?:\/\/[^/]+/, "")}`
      : "";
    const respInfo = lastVercelResponse
      ? ` | resp=${lastVercelResponse.status}: ${lastVercelResponse.body}`
      : "";
    throw new Error(`connectSandbox failed: ${err?.name}: ${err?.message}${reqInfo}${respInfo}`, { cause: e });
  } finally {
    globalThis.fetch = originalFetch;
    if (setupToken) {
      await revokeInstallationToken(setupToken.token);
    }
  }

  const rawSandboxState = sandbox.getState?.();
  const sandboxState = isSandboxState(rawSandboxState)
    ? rawSandboxState
    : buildSandboxState(session);

  await Promise.all([
    updateSession(params.sessionId, {
      sandboxState,
      snapshotUrl: null,
      snapshotCreatedAt: null,
      lifecycleVersion: getNextLifecycleVersion(session.lifecycleVersion),
      ...buildActiveLifecycleUpdate(sandboxState),
    }),
    installSessionGlobalSkills({
      session,
      sandbox,
      didSetupWorkspace,
    }),
  ]);

  kickSandboxLifecycleWorkflow({
    sessionId: params.sessionId,
    reason: "sandbox-created",
  });

  const skills = await loadSessionSkills({
    sessionId: params.sessionId,
    sandboxState,
    sandbox,
  });

  return {
    sandboxState,
    workingDirectory: sandbox.workingDirectory,
    currentBranch: sandbox.currentBranch,
    environmentDetails: sandbox.environmentDetails,
    skills,
    didSetupWorkspace,
    sessionTitle: session.title,
    repoOwner: session.repoOwner ?? undefined,
    repoName: session.repoName ?? undefined,
  };
}
