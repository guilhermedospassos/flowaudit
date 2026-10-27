import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

it('excludes private workflow exports and reports from the distributed package', async () => {
  await mkdir('.tmp', { recursive: true });
  const temporaryDir = await mkdtemp(resolve('.tmp/distribution-'));
  const markers: string[] = [];
  const execute = promisify(execFile);
  try {
    for (const directory of ['local-workflows', 'local-reports']) {
      await mkdir(directory, { recursive: true });
      const marker = resolve(directory, `synthetic-package-test-${randomUUID()}.json`);
      await writeFile(marker, '{"syntheticPrivateMarker":true}', { flag: 'wx' });
      markers.push(marker);
    }
    const npmCli = process.env.npm_execpath;
    if (!npmCli) throw new Error('Execute this integration test with npm test.');
    const { stdout } = await execute(process.execPath, [npmCli, 'pack', '--dry-run', '--json',
      '--ignore-scripts', '--offline', '--cache', join(temporaryDir, 'cache'),
      '--logs-dir', join(temporaryDir, 'logs')]);
    const packages = JSON.parse(stdout) as Array<{ files: Array<{ path: string }> }>;
    const paths = packages[0]!.files.map((file) => file.path.replaceAll('\\', '/'));
    const privatePaths = paths.filter((path) => /^(?:local-workflows|local-reports|\.tmp|\.git|tests|examples|node_modules)\//u.test(path)
      || /(?:^|\/)\.env(?:\.|$)/u.test(path));
    // Only counts are asserted, so a failing test cannot print private names.
    expect(privatePaths.length).toBe(0);
    expect(paths.includes('package.json')).toBe(true);
    expect(paths.includes('SECURITY.md')).toBe(true);
  } finally {
    await Promise.all(markers.map((path) => rm(path, { force: true })));
    await rm(temporaryDir, { recursive: true, force: true });
  }
}, 15_000);
