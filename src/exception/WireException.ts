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

/**
 * Base class for all Wire SDK exceptions. Extend this directly for any new
 * error variant instead of throwing plain `Error`s.
 */
export abstract class WireException extends Error {
  protected constructor(message?: string, cause?: Error) {
    super(message ?? cause?.message)
    this.name = new.target.name
    this.cause = cause

    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/** The caller is authorized but doesn't have permission for this action. */
export class ForbiddenError extends WireException {
  static readonly DEFAULT_MESSAGE = 'User does not have permission to perform this action'

  constructor(message: string = ForbiddenError.DEFAULT_MESSAGE, cause?: Error) {
    super(message, cause)
  }

  static appIsNotAdminInConversation(): ForbiddenError {
    return new ForbiddenError('App user is not an admin in the conversation.')
  }

  static appIsNotInConversation(): ForbiddenError {
    return new ForbiddenError('App user is not in the conversation.')
  }
}

/** A required parameter/argument was not provided. */
export class MissingParameterError extends WireException {
  constructor(message?: string, cause?: Error) {
    super(message, cause)
  }
}

/** A parameter/argument was provided but its value is invalid. */
export class InvalidParameterError extends WireException {
  static readonly DEFAULT_MESSAGE = 'One or more parameters are invalid.'

  constructor(message: string = InvalidParameterError.DEFAULT_MESSAGE, cause?: Error) {
    super(message, cause)
  }

  static messageIsNotEphemeral(): InvalidParameterError {
    return new InvalidParameterError('Message type is not ephemeral. Cannot be sent to ephemeral conversation.')
  }
}

/** The caller's credentials are missing or invalid. */
export class AuthenticationError extends WireException {
  constructor(message?: string, cause?: Error) {
    super(message, cause)
  }
}

/** Any error originating from the cryptography layer (MLS/Proteus/core-crypto). */
export class CryptographicSystemError extends WireException {
  constructor(message?: string, cause?: Error) {
    super(message, cause)
  }
}

/** Any error originating from the database layer. */
export class DatabaseError extends WireException {
  constructor(message?: string, cause?: Error) {
    super(message, cause)
  }
}

/** Catch-all for errors that don't fit any of the above. */
export class UnknownError extends WireException {
  constructor(message?: string, cause?: Error) {
    super(message, cause)
  }
}
