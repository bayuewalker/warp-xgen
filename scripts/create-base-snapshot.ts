/**
 * create-base-snapshot.ts — v3
 *
 * KEY CHANGES:
 *   v1 → v2: persistent: true, snapshotExpiration: 0, ports match production.
 *   v2 → v3: EXPLICIT runtime: "node24" — @vercel/sandbox@beta defaults to
 *            node22, but the open-agents production runtime expects node24.
 *            Mismatch caused API to return 404 ("no matching sandbox image").
 *
 * Required env vars (provided by GitHub Actions secrets):
 *   VERCEL_TOKEN
 *   VERCEL_TEAM_ID
 *   VERCEL_PROJECT_ID
 *   INCLUDE_CHROMIUM   (optional, "true" to install chromium + agent-browser)
 *
 * Output (parsed by workflow):
 *   SNAPSHOT_ID=snap_xxxxx
 */

import { Sandbox } from "@vercel/sandbox";

const MS_PER_MINUTE = 60 * 1000;
const SANDBOX_TIMEOUT_MS = 25 * MS_PER_MINUTE;

// Match apps/web/lib/sandbox/config.ts → DEFAULT_SANDBOX_PORTS
// 3000: Next.js / Express / Remix
// 5173: Vite / SvelteKit
// 4321: Astro
// 8000: code-server (built-in editor)
const DEFAULT_PORTS = [3000, 5173, 4321, 8000];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

async function runStep(
  sandbox: Sandbox,
  label: string,
  cmd: string,
  args: string[],
): Promise<void> {
  console.log(`\n▶ ${label}`);
  console.log(`  $ ${cmd} ${args.join(" ")}`);

  const result = await sandbox.runCommand({
    cmd,
    args,
    stderr: process.stderr,
    stdout: process.stdout,
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `Step "${label}" failed with exit code ${result.exitCode}`,
    );
  }
  console.log(`  ✓ ${label} done`);
}

async function main(): Promise<void> {
  const token = requireEnv("VERCEL_TOKEN");
  const teamId = requireEnv("VERCEL_TEAM_ID");
  const projectId = requireEnv("VERCEL_PROJECT_ID");
  const includeChromium = process.env.INCLUDE_CHROMIUM === "true";

  console.log("=== warp-xgen base snapshot generator (v2) ===");
  console.log(`Team:     ${teamId}`);
  console.log(`Project:  ${projectId}`);
  console.log(`Chromium: ${includeChromium ? "yes" : "no (minimal snapshot)"}`);
  console.log(`Mode:     persistent: true (matches runtime expectation)`);
  console.log("");

  console.log("→ Creating fresh sandbox (persistent: true, runtime: node24)...");
  const sandbox = await Sandbox.create({
    teamId,
    projectId,
    token,
    runtime: "node24",
    timeout: SANDBOX_TIMEOUT_MS,
    resources: { vcpus: 4 },
    ports: DEFAULT_PORTS,
    persistent: true,
    snapshotExpiration: 0,
  });
  console.log(`✓ Sandbox created (runtime: ${sandbox.runtime ?? "default"})`);

  let snapshotId: string | undefined;

  try {
    // Refresh package metadata once
    await runStep(
      sandbox,
      "dnf metadata refresh",
      "sudo",
      ["dnf", "makecache", "--refresh"],
    );

    // jq — required by open-agents shell utils & skill metadata
    await runStep(
      sandbox,
      "Install jq",
      "sudo",
      ["dnf", "install", "-y", "jq"],
    );

    // bun — primary package manager inside sandboxes
    await runStep(
      sandbox,
      "Install bun",
      "bash",
      [
        "-c",
        "curl -fsSL https://bun.sh/install | bash && sudo ln -sf $HOME/.bun/bin/bun /usr/local/bin/bun && bun --version",
      ],
    );

    // Optional: chromium + agent-browser for sessions that need browser automation
    if (includeChromium) {
      await runStep(
        sandbox,
        "Install chromium dependencies",
        "sudo",
        [
          "dnf",
          "install",
          "-y",
          "chromium",
          "nss",
          "alsa-lib",
          "atk",
          "cups-libs",
          "libdrm",
          "libxkbcommon",
          "mesa-libgbm",
        ],
      );

      await runStep(
        sandbox,
        "Install agent-browser",
        "bash",
        ["-c", "npm install -g agent-browser && agent-browser --version"],
      );
    }

    console.log("\n→ Capturing snapshot (no expiration)...");
    const snapshot = await sandbox.snapshot({ expiration: 0 });
    snapshotId = snapshot.snapshotId;
    console.log(`✓ Snapshot captured`);
  } finally {
    try {
      console.log("\n→ Stopping sandbox...");
      await sandbox.stop();
      console.log("✓ Sandbox stopped");
    } catch (stopError) {
      console.warn(
        `⚠ Failed to stop sandbox cleanly (this is usually fine after snapshot): ${
          stopError instanceof Error ? stopError.message : String(stopError)
        }`,
      );
    }
  }

  if (!snapshotId) {
    throw new Error("Snapshot creation failed — no snapshot ID returned.");
  }

  console.log("");
  console.log("=== SUCCESS ===");
  console.log(`SNAPSHOT_ID=${snapshotId}`);
  console.log("");
  console.log("Next steps:");
  console.log(`  1. Vercel env: VERCEL_SANDBOX_BASE_SNAPSHOT_ID=${snapshotId}`);
  console.log("  2. Redeploy production WITHOUT build cache");
  console.log("  3. Test session creation");
}

main().catch((error) => {
  console.error("\n✗ FAILED:");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
