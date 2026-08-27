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

/* eslint-disable no-undef */

import dotenv from 'dotenv'

dotenv.config({path: '../.env'})

const apiToken = process.env['WIRE_SDK_API_TOKEN']
const apiHost = process.env['WIRE_SDK_API_HOST']

if (!apiToken) {
  throw new Error('WIRE_SDK_API_TOKEN must be set in .env file')
}

if (!apiHost) {
  throw new Error('WIRE_SDK_API_HOST must be set in .env file')
}

export const WIRE_API_TOKEN: string = apiToken
export const WIRE_API_HOST: string = apiHost

/**
 * For demonstration purposes we use a static cryptography storage key. In a production
 * application, ensure to generate, store, and manage this key securely.
 */
export const CRYPTOGRAPHY_STORAGE_KEY: Uint8Array = new Uint8Array(32).fill(1)
