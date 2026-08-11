/*
 * Wire
 * Copyright (C) 2025 Wire Swiss GmbH
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

import {writeFileSync, mkdirSync} from 'fs'
import {join} from 'path'

const generatedDir = 'src/generated'
const packageJsonPath = join(generatedDir, 'package.json')

// Ensure directory exists
mkdirSync(generatedDir, {recursive: true})

// Create package.json content
const packageJson = {
  type: 'commonjs'
}

// Write the file
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8')

console.log('✓ Created src/generated/package.json')
