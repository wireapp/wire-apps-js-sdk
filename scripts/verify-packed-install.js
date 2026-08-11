/*
 * Wire
 * Copyright (C) 2026 Wire Swiss GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 */

import {execFileSync} from 'node:child_process'
import {existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

const projectRoot = process.cwd()
const tempRoot = mkdtempSync(join('/tmp', 'wire-sdk-pack-smoke-'))
const npmCache = join(tempRoot, 'npm-cache')

const npmExecPath = process.env['npm_execpath']
const npmCommand = npmExecPath ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npmBaseArgs = npmExecPath ? [npmExecPath] : []

const runNpm = (args, cwd) => {
  execFileSync(npmCommand, [...npmBaseArgs, ...args], {
    cwd,
    stdio: 'inherit'
  })
}

try {
  runNpm(['pack', '--pack-destination', tempRoot, '--cache', npmCache, '--silent'], projectRoot)

  const tarball = readdirSync(tempRoot).find((file) => file.endsWith('.tgz'))
  if (!tarball) {
    throw new Error(`npm pack did not create a tarball in ${tempRoot}`)
  }

  const tarballPath = join(tempRoot, tarball)

  writeFileSync(
    join(tempRoot, 'package.json'),
    JSON.stringify(
      {
        private: true,
        type: 'module',
        scripts: {
          smoke: 'node smoke.mjs'
        },
        dependencies: {
          '@wireapp/wire-apps-js-sdk': `file:${tarballPath}`
        }
      },
      null,
      2
    ) + '\n'
  )

  writeFileSync(
    join(tempRoot, 'smoke.mjs'),
    `
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as sdk from '@wireapp/wire-apps-js-sdk';
import Database from 'better-sqlite3';

if (!sdk.WireAppSdk) {
  throw new Error('WireAppSdk export is missing');
}

const db = new Database(':memory:');
db.close();

await import('@wireapp/core-crypto/native');

const appRoot = fileURLToPath(new URL('.', import.meta.url));
const packageRoot = join(appRoot, 'node_modules/@wireapp/wire-apps-js-sdk');
const requiredFiles = [
  'build/index.js',
  'build/index.d.ts',
  'build/generated/messages.js',
  'build/db/migrations/0000_pink_lord_tyger.sql'
];

for (const file of requiredFiles) {
  if (!existsSync(join(packageRoot, file))) {
    throw new Error(\`Packed SDK is missing required file: \${file}\`);
  }
}

console.log('packed-install-smoke-ok');
`
  )

  runNpm(['install', '--omit=dev', '--ignore-scripts=false', '--cache', npmCache], tempRoot)
  runNpm(['run', 'smoke'], tempRoot)
} finally {
  rmSync(tempRoot, {recursive: true, force: true})
}
