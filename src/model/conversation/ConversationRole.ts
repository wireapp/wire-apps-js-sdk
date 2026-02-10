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

// TODO: Baris: It will be good rename this class to MemberRole or ConversationMemberRole,
//  because it is not a role of conversation but a role of member in conversation.
//  It will be more clear to understand the code when we have ConversationMemberRole.MEMBER instead of ConversationRole.MEMBER.
//  I prefer making this change in a separate PR.


// TODO: Baris: At the moment, this class is not used for the verification of the incoming values.
//  Because TS types are erased at runtime, we need to add a function to verify the incoming values
//  and convert them to ConversationRole type.
export enum ConversationRole {
  MEMBER = "wire_member",
  ADMIN = "wire_admin",
  UNKNOWN = "unknown"
}
