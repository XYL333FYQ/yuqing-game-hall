import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import test from 'node:test';

const windowsGitBash = join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe');
const bash = process.env.BASH_EXE || (process.platform === 'win32' ? windowsGitBash : 'bash');
const bashAvailable = existsSync(bash) && spawnSync(bash, ['--version'], { encoding: 'utf8' }).status === 0;
const scriptsDir = resolve(import.meta.dirname);

function runWithMock(name, mock, args, extraEnv = {}) {
  const temp = mkdtempSync(join(tmpdir(), 'yuqing-image-retention-'));
  try {
    const bin = join(temp, 'bin');
    mkdirSync(bin);
    const executable = join(bin, name);
    writeFileSync(executable, mock, 'utf8');
    chmodSync(executable, 0o755);
    const log = join(temp, 'calls.log');
    const result = spawnSync(bash, args, {
      encoding: 'utf8',
      env: {
        ...process.env,
        ...extraEnv,
        PATH: `${bin}${delimiter}${process.env.PATH}`,
        MOCK_LOG: log,
      },
    });
    return { result, log: readFileSync(log, 'utf8') };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

test('VPS cleanup keeps current and previous SHA images and removes older tags', { skip: !bashAvailable }, () => {
  const current = 'a'.repeat(40);
  const previous = 'b'.repeat(40);
  const old = 'c'.repeat(40);
  const mockDocker = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$MOCK_LOG"
if [[ "$1 $2" == "image ls" ]]; then
  for value in "$@"; do
    if [[ "$value" == reference=* ]]; then repository="${'${'}value#reference=}"; fi
  done
  repository="${'${'}repository%:*}"
  printf '%s\\n' "${'${'}repository}:${'${'}MOCK_CURRENT}" "${'${'}repository}:${'${'}MOCK_PREVIOUS}" "${'${'}repository}:${'${'}MOCK_OLD}" "${'${'}repository}:latest"
fi
`;
  const { result, log } = runWithMock(
    'docker',
    mockDocker,
    [
      join(scriptsDir, 'prune-deployed-images.sh'),
      'ghcr.io/example/hall',
      current,
      previous,
    ],
    { MOCK_CURRENT: current, MOCK_PREVIOUS: previous, MOCK_OLD: old },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal((log.match(/image rm/g) || []).length, 10);
  assert.match(log, new RegExp(`image rm ghcr\\.io/example/hall-fruit-party:${old}`));
  assert.match(log, /image rm ghcr\.io\/example\/hall-fruit-party:latest/);
  assert.match(log, /image prune --force/);
  assert.doesNotMatch(log, new RegExp(`image rm ghcr\\.io/example/hall-fruit-party:${current}`));
  assert.doesNotMatch(log, new RegExp(`image rm ghcr\\.io/example/hall-fruit-party:${previous}`));
});

test('GHCR cleanup retains package versions tagged with current and previous SHA', { skip: !bashAvailable }, () => {
  const current = 'd'.repeat(40);
  const previous = 'e'.repeat(40);
  const mockGh = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$MOCK_LOG"
if [[ "$1" == "api" && "$2" == users/* ]]; then
  echo User
elif [[ "$1" == "api" && "$2" == "--paginate" ]]; then
  printf '101\\t%s\\n102\\t%s\\n103\\t%s\\n' "$MOCK_CURRENT" "$MOCK_PREVIOUS" "$MOCK_OLD"
fi
`;
  const { result, log } = runWithMock(
    'gh',
    mockGh,
    [join(scriptsDir, 'prune-ghcr-versions.sh'), current, previous],
    {
      GITHUB_REPOSITORY: 'Example/Hall',
      MOCK_CURRENT: current,
      MOCK_PREVIOUS: previous,
      MOCK_OLD: 'f'.repeat(40),
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal((log.match(/--method DELETE/g) || []).length, 5);
  assert.match(log, /packages\/container\/hall-fruit-party\/versions\/103/);
  assert.doesNotMatch(log, /versions\/(?:101|102)(?:\s|$)/);
});
