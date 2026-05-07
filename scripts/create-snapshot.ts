import { Sandbox } from '@vercel/sandbox';

const sandbox = await Sandbox.create({
  runtime: 'node24',
});

console.log('Sandbox created:', sandbox.sandboxId);

// Install basic tools
await sandbox.exec('apt-get install -y git curl');

const snap = await sandbox.snapshot();
console.log('✅ VERCEL_SANDBOX_BASE_SNAPSHOT_ID=' + snap.snapshotId);

await sandbox.stop();
