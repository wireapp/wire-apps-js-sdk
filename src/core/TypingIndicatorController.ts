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

import {QualifiedId} from '../model/QualifiedId.js'
import {TypingStatus} from '../model/conversation/TypingStatus.js'
import {LoggerFactory} from '../utils/logger/LoggerFactory.js'

const REFRESH_INTERVAL_MS = 30_000
const MAX_DURATION_MS = 300_000

interface TypingSession {
  references: number
  closed: boolean
  pending: Promise<void>
  refreshTimer?: ReturnType<typeof setTimeout>
  maximumTimer?: ReturnType<typeof setTimeout>
}

/** Coordinates one ordered typing session per conversation within an application manager. */
export class TypingIndicatorController {
  private readonly sessions = new Map<string, TypingSession>()
  private readonly logger = LoggerFactory.getLogger(this.constructor.name)

  constructor(private readonly send: (conversationId: QualifiedId, status: TypingStatus) => Promise<void>) {}

  acquire(conversationId: QualifiedId): () => void {
    const key = QualifiedId.toKey(conversationId)
    let session = this.sessions.get(key)
    if (!session || session.references === 0) {
      // A new session waits for the preceding session's STOPPED, even though its work starts immediately.
      session = {references: 0, closed: false, pending: session?.pending ?? Promise.resolve()}
      this.sessions.set(key, session)
      const current = session
      this.enqueue(conversationId, current, TypingStatus.STARTED)
      this.scheduleRefresh(conversationId, current)
      current.maximumTimer = setTimeout(() => this.close(conversationId, current), MAX_DURATION_MS)
    }
    session.references++
    const current = session
    let released = false
    return () => {
      if (released) return
      released = true
      current.references--
      if (current.references === 0) {
        this.close(conversationId, current)
        // Expired sessions already have a completed or pending STOPPED.
        void current.pending.then(() => this.removeIdle(key, current))
      }
    }
  }

  private scheduleRefresh(conversationId: QualifiedId, session: TypingSession): void {
    session.refreshTimer = setTimeout(() => {
      if (session.closed) return
      this.enqueue(conversationId, session, TypingStatus.STARTED)
      this.scheduleRefresh(conversationId, session)
    }, REFRESH_INTERVAL_MS)
  }

  private close(conversationId: QualifiedId, session: TypingSession): void {
    if (session.closed) return
    session.closed = true
    clearTimeout(session.refreshTimer)
    clearTimeout(session.maximumTimer)
    this.enqueue(conversationId, session, TypingStatus.STOPPED)
  }

  private enqueue(conversationId: QualifiedId, session: TypingSession, status: TypingStatus): void {
    session.pending = session.pending.then(async () => {
      // Do not send a queued refresh after the session ends or reaches its upper bound.
      if (status === TypingStatus.STARTED && session.closed) return
      try {
        await this.send(conversationId, status)
      } catch (error) {
        this.logger.warn(`Could not send typing status ${status} in conversation ${conversationId}`, error)
      }
    })
    void session.pending.then(() => this.removeIdle(QualifiedId.toKey(conversationId), session))
  }

  private removeIdle(key: string, session: TypingSession): void {
    if (session.references === 0 && session.closed && this.sessions.get(key) === session) {
      // The current tail may include STOPPED; keep it available to a new session until it settles.
      const pending = session.pending
      void pending.then(() => {
        if (session.pending === pending && session.references === 0 && this.sessions.get(key) === session) {
          this.sessions.delete(key)
        }
      })
    }
  }
}
