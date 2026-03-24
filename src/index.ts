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
export { WireAppSdk } from './WireAppSdk.js';

// ============================================
// Core Components
// ============================================
export { WireEventsHandler } from "./core/WireEventsHandler.js"

// ============================================
// Logger Interface
// ============================================
export type { Logger } from "./utils/logger/Logger.js"
export { LogLevel } from "./utils/logger/LogLevel.js"
export { ConsoleLogger } from "./utils/logger/ConsoleLogger.js"

// ============================================
// Model Classes
// ============================================
export {
  type WireMessage,
  // Text
  TextMessage,
  // Asset
  AssetMessage,
  type Audio,
  type Image,
  type Video,
  // Composite / UI Components
  CompositeMessage,
  type Button,
  type CompositeItem,
  ButtonActionMessage,
  ButtonActionConfirmationMessage,
  // Other message types
  KnockMessage,
  LocationMessage,
  ReactionMessage,
  MessageDeleteMessage,
  MessageEditMessage,
  ConfirmationMessage,
  type ConfirmationType,
} from "./model/WireMessage.js"

export type { Conversation } from "./model/conversation/Conversation.js";
export type { ConversationMember } from "./model/conversation/ConversationMember.js";
export type { UserProfile } from "./model/user/UserProfile.js";
export type { QualifiedId } from "./model/QualifiedId.js";
export { obfuscateId } from "./utils/ObfuscateUtil.js"

// ============================================
// Exceptions
// ============================================
export { ConversationException, isConversationException } from "./model/exception/ConversationException.js"
