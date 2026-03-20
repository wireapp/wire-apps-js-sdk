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

import type {QualifiedId} from "../../model/QualifiedId.js"
import type {UserResponse} from "../model/UserResponse.js"

// Mirrors the shape returned by POST /list-users on the Wire backend.
// failed: IDs the server could not look up (e.g. federated backend unreachable).
// not_found: IDs that simply do not exist.
// We only act on `found`; the other arrays are retained so callers can log or retry if needed.
export interface ListUsersResponse {
  found: UserResponse[]
  failed: QualifiedId[]
  not_found: QualifiedId[]
}
