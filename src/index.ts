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

// ============================================
// Main SDK Class
// ============================================
export {WireAppSdk} from './WireAppSdk.js'

// ============================================
// Core Components
// ============================================
export {WireEventsHandler} from './core/WireEventsHandler.js'
export {WireApplicationManager} from './core/WireApplicationManager.js'
export type {BackendConnectionListener} from './core/BackendConnectionListener.js'

// ============================================
// Logger Interface
// ============================================
export type {Logger} from './utils/logger/Logger.js'
export {LogLevel} from './utils/logger/LogLevel.js'
export {ConsoleLogger} from './utils/logger/ConsoleLogger.js'

// ============================================
// Model Classes
// ============================================
export {
  type WireMessage,
  TextMessage,
  TextEditedMessage,
  AssetMessage,
  CompositeButton,
  CompositeButtonAction,
  CompositeMessage,
  CompositeEditedMessage,
  Ping,
  Location,
  DeletedMessage,
  Receipt,
  ReceiptType,
  WireMessageType,
  Reaction,
  Ignored,
  Unknown,
  type LinkPreview,
  type Audio,
  type Image,
  type Video
} from './model/WireMessage.js'

export type {Conversation} from './model/conversation/Conversation.js'
export type {ConversationMember} from './model/conversation/ConversationMember.js'
export {ConversationRole} from './model/conversation/ConversationRole.js'
export type {RemoveMembersFromConversationResult} from './api/model/RemoveMembersFromConversationResult.js'
export {QualifiedId} from './model/QualifiedId.js'
export {TeamId} from './model/TeamId.js'
export {WireUser} from './model/WireUser.js'
export {UserType} from './model/UserType.js'
export {obfuscateId} from './utils/ObfuscateUtil.js'
export {
  WireException,
  ForbiddenError,
  MissingParameterError,
  InvalidParameterError,
  CryptographicSystemError,
  AuthenticationError,
  DatabaseError,
  UnknownError
} from './exception/WireException.js'
