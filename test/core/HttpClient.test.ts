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

import { describe, it } from 'vitest';

describe('HttpClient', () => {
  describe('Access token', () => {
    it('should be set after successful response to `/access` endpoint', () => {

    });
    it('should be updated with client ID when it is registered', () => {

    })
  })
  describe('App token', () => {
    it('should be set in Cookie header in request to `/access` endpoint', () => {

    });
    it('should be replaced when a new cookie is available', () => {

    });
    it('should be deleted when expired', () => {

    });
  })
  describe('Query param `client_id`', () => {
    it('should be set when stored', () => {

    });
    it('should be omitted when not stored', () => {

    });
  })
})
