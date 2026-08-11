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

import type { CommitBundle, HistorySecret, MlsTransport, MlsTransportData } from "@wireapp/core-crypto/native";
import { MlsService } from "../api/MlsService.js";
import { singleton } from "tsyringe";
import {UnknownError} from "../exception/WireException.js";

@singleton()
export class CoreCryptoMlsTransport implements MlsTransport {
  constructor(private mlsService: MlsService) {}

  async sendCommitBundle(commitBundle: CommitBundle): Promise<void> {
    await this.mlsService.uploadCommitBundle(
      this.parseBundleIntoUint8Array(commitBundle)
    )
  }

  async prepareForTransport(__: HistorySecret): Promise<MlsTransportData> {
    throw new UnknownError("This method is not applicable for SDKs.")
  }

  /**
   * Returns the CommitBundle data as a single byte array, in a specific order.
   *
   * The order is: commit, groupInfo, welcome (optional).
   * The created bundle will be pushed in this format to the backend when joining a conversation.
   *
   * @param commitBundle - The CommitBundle to parse.
   * @returns A single Uint8Array containing the combined data.
   */
  private parseBundleIntoUint8Array(commitBundle: CommitBundle): Uint8Array {
    const commit = commitBundle.commit
    const payload = commitBundle.groupInfo.payload
    const welcome = commitBundle.welcome ? commitBundle.welcome.serialize() : new Uint8Array(0)

    const totalLength = commit.length + payload.length + welcome.length
    const combined = new Uint8Array(totalLength)

    combined.set(commit, 0);
    combined.set(payload, commit.length)
    combined.set(welcome, commit.length + payload.length)

    return combined;
  }
}
