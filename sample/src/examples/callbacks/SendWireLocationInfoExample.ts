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

import {Location, type QualifiedId, TextMessage, WireEventsHandler} from '@wireapp/wire-apps-js-sdk'
import {exampleLogger} from '../ExampleLogger.js'

/**
 * This example listens for incoming text messages. If the message contains the text "Where is Wire?",
 * it responds with a location message containing the coordinates of Wire's headquarters in Berlin, Germany.
 */
export class SendWireLocationInfoExample extends WireEventsHandler {
  public override async onTextMessageReceived(wireMessage: TextMessage): Promise<void> {
    if (wireMessage.text.toLowerCase().includes('where is wire?')) {
      await this.sendLocationInfo(wireMessage.conversationId)
    }
  }

  private async sendLocationInfo(conversationId: QualifiedId): Promise<void> {
    const locationInfoMessage = Location.create({
      conversationId: conversationId,
      latitude: 52.52401159,
      longitude: 13.40240811,
      name: 'Wire GmbH!',
      zoom: 15
    })

    await this.manager.sendMessage(locationInfoMessage)
    exampleLogger.info(`Location message sent. conversationId: ${conversationId}`)
  }
}
