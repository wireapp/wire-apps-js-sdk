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

import {HttpClient} from "../core/HttpClient.js";
import {singleton} from "tsyringe";
import type {SearchContactsResponse} from "./response/SearchContactsResponse.js";
import {InvalidParameterError} from "../exception/WireException.js";

const DEFAULT_RESULT_SIZE = 15;
const MIN_RESULT_SIZE = 1;
const MAX_RESULT_SIZE = 500;

@singleton()
export class SearchApiClient {
  constructor(private httpClient: HttpClient) {
  }

  private readonly basePath = "search";

  async searchUsers(
    query: string,
    domain: string,
    numberOfResults?: number
  ): Promise<SearchContactsResponse> {
    const size = numberOfResults ?? DEFAULT_RESULT_SIZE;

    if (size < MIN_RESULT_SIZE || size > MAX_RESULT_SIZE) {
      throw new InvalidParameterError(`Number of results value must be between ${MIN_RESULT_SIZE} and ${MAX_RESULT_SIZE}. Value provided: ${size}`);
    }
    if (!query.trim()) {
      throw new InvalidParameterError("Search query must not be blank.");
    }
    if (!domain.trim()) {
      throw new InvalidParameterError("Domain must not be blank.");
    }

    const params = new URLSearchParams({
      q: query,
      domain,
      type: "regular",
      size: String(size),
    });

    return await this.httpClient.getRequest<SearchContactsResponse>(`${this.basePath}/contacts?${params}`);
  }
}
