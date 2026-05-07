/**
 * create-base-snapshot.ts
 *
 * Creates a fresh Vercel Sandbox from the default node24 image (no parent
 * snapshot), installs the minimum tools that open-agents/warp-xgen expects
 * (bun + jq), optionally adds chromium + agent-browser, then snapshots it.
 *
 * Designed to be run inside GitHub Actions with these env vars:
 *   VERCEL_TOKEN
 *   VERCEL_TEAM_ID
 *   VERCEL_PROJECT_ID
 *   INCLUDE_CHROMIUM  (optional, "true" to install chromium + agent-browser)
 *
 * Output:
 *   Prints "SNAPSHOT_ID=snap_xxxxx" on success — the workflow extracts that.
 */

import { Sandbox } from "@vercel/sandbox";

const MS_PER_MINUTE = 60 * 1000;
const SANDBOX_TIMEOUT_MS = 25 * MS_PER_MINUTE;
const COMMAND_TIMEOUT_MS = 10 * MS_PER_MINUTE;

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
  // Validate auth env early
  const token = requireEnv("VERCEL_TOKEN");
  const teamId = requireEnv("VERCEL_TEAM_ID");
  const projectId = requireEnv("VERCEL_PROJECT_ID");
  const includeChromium = process.env.INCLUDE_CHROMIUM === "true";

  console.log("=== warp-xgen base snapshot generator ===");
  console.log(`Team:    ${teamId}`);
  console.log(`Project: ${projectId}`);
  console.log(`Chromium: ${includeChromium ? "yes" : "no (minimal snapshot)"}`);
  console.log("");

  console.log("→ Creating fresh sandbox (no parent snapshot)...");
  const sandbox = await Sandbox.create({
    teamId,
    projectId,
    token,
    runtime: "node24",
    timeout: SANDBOX_TIMEOUT_MS,
    resources: { vcpus: 4 },
    persistent: false,
  });
  console.log(`✓ Sandbox created`);

  let snapshotId: string | undefined;

  try {
    // Refresh package metadata once
    await runStep(
      sandbox,
      "dnf metadata refresh",
      "sudo",
      ["dnf", "makecache", "--refresh"],
    );

    // jq — required by open-agents skills metadata cache and shell utils
    await runStep(
      sandbox,
      "Install jq",
      "sudo",
      ["dnf", "install", "-y", "jq"],
    );

    // bun — primary package manager for open-agents app code that runs in sandbox
    await runStep(
      sandbox,
      "Install bun",
      "bash",
      [
        "-c",
        "curl -fsSL https://bun.sh/install | bash && sudo ln -sf $HOME/.bun/bin/bun /usr/local/bin/bun && bun --version",
      ],
    );

    // Optional: chromium + agent-browser (only if user opted in — significantly slower)
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

    console.log("\n→ Capturing snapshot...");
    const snapshot = await sandbox.snapshot();
    snapshotId = snapshot.snapshotId;
    console.log(`✓ Snapshot captured`);
  } finally {
    // Always stop the sandbox — even if something failed earlier
    try {
      console.log("\n→ Stopping sandbox...");
      await sandbox.stop();
      console.log("✓ Sandbox stopped");
    } catch (stopError) {
      console.warn(
        `⚠ Failed to stop sandbox cleanly: ${
          stopError instanceof Error ? stopError.message : String(stopError)
        }`,
      );
    }
  }

  if (!snapshotId) {
    throw new Error("Snapshot creation failed — no snapshot ID returned.");
  }

  // Sentinel line that the workflow grep parses out
  console.log("");
  console.log("=== SUCCESS ===");
  console.log(`SNAPSHOT_ID=${snapshotId}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Add to Vercel env:");
  console.log(`       VERCEL_SANDBOX_BASE_SNAPSHOT_ID=${snapshotId}`);
  console.log("  2. Redeploy production (uncheck 'Use existing Build Cache')");
  console.log("  3. Test session creation");
}

main().catch((error) => {
  console.error("\n✗ FAILED:");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
