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

import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {MLSWelcomeDTO} from '../../../src/model/EventContentDTO.js'
import {ConversationService} from '../../../src/api/ConversationService.js'
import {MlsService} from '../../../src/api/MlsService.js'
import {MlsWelcomeEventProcessor} from '../../../src/core/event/MlsWelcomeEventProcessor.js'
import type {WireEventsHandler} from '../../../src/core/WireEventsHandler.js'
import {CoreCryptoService} from '../../../src/core/CoreCryptoService.js'
import {ConversationMapper} from '../../../src/mappers/conversation/ConversationMapper.js'
import {ConversationRole} from '../../../src/model/conversation/ConversationRole.js'
import {AppProperties} from '../../../src/service/AppProperties.js'

vi.mock('../../../src/api/ConversationService.js')
vi.mock('../../../src/api/MlsService.js')
vi.mock('../../../src/core/CoreCryptoService.js')
vi.mock('../../../src/mappers/conversation/ConversationMapper.js')
vi.mock('bazinga64', () => ({
  Decoder: {
    fromBase64: vi.fn().mockReturnValue({asBytes: new Uint8Array([1, 2, 3])}),
  },
}))

const qualifiedConversation = {id: 'conv-123', domain: 'example.com'}
const groupInfoBytes = new Uint8Array([4, 5, 6])
const welcomeBytes = new Uint8Array([1, 2, 3])
const keyPackages = [new Uint8Array([7, 8, 9])]

const makeEvent = (): MLSWelcomeDTO => ({
  type: 'conversation.mls-welcome',
  time: new Date(),
  data: 'base64encodedwelcome',
  qualified_conversation: qualifiedConversation,
  qualified_from: {id: 'user-from', domain: 'example.com'},
})

const makeConversationEntity = () => ({
  id: qualifiedConversation.id,
  domain: qualifiedConversation.domain,
  name: 'Test Conversation',
  team_id: 'team-1',
  mls_group_id: 'mls-group-id',
  creation_date: null,
  type: 'group',
})

const makeConversation = () => ({
  id: qualifiedConversation.id,
  domain: qualifiedConversation.domain,
  name: 'Test Conversation',
  type: 'group',
  teamId: 'team-1',
})

const makeMembers = () => [
  {userId: {id: 'user-1', domain: 'example.com'}, role: ConversationRole.MEMBER},
]

let coreCryptoService: CoreCryptoService
let conversationService: ConversationService
let mlsService: MlsService
let appProperties: AppProperties
let wireEventsHandler: WireEventsHandler
let processor: MlsWelcomeEventProcessor

beforeEach(() => {
  vi.clearAllMocks()

  coreCryptoService = {
    processWelcomeMessage: vi.fn().mockResolvedValue(undefined),
    hasTooFewKeyPackageCount: vi.fn().mockResolvedValue(false),
    mlsGenerateKeyPackages: vi.fn().mockResolvedValue(keyPackages),
  } as any

  conversationService = {
    getConversationGroupInfo: vi.fn().mockResolvedValue(groupInfoBytes),
    fetchConversationById: vi.fn().mockResolvedValue({}),
    saveConversationWithMembers: vi.fn().mockResolvedValue({
      conversation: makeConversationEntity(),
      members: makeMembers(),
    }),
  } as any

  mlsService = {
    uploadMlsKeyPackages: vi.fn().mockResolvedValue(undefined),
  } as any

  appProperties = {
    getDeviceId: vi.fn().mockReturnValue('device-id'),
  } as any

  wireEventsHandler = {
    onAppAddedToConversation: vi.fn().mockResolvedValue(undefined),
  } as any

  vi.mocked(ConversationMapper.fromEntity).mockReturnValue(makeConversation() as any)

  processor = new MlsWelcomeEventProcessor(coreCryptoService, conversationService, mlsService, appProperties, wireEventsHandler)
})

describe('MlsWelcomeEventProcessor', () => {
  describe('process', () => {
    it('should decode the event data and process the welcome message', async () => {
      await processor.process(makeEvent())

      expect(coreCryptoService.processWelcomeMessage).toHaveBeenCalledTimes(1)
      expect(coreCryptoService.processWelcomeMessage).toHaveBeenCalledWith(welcomeBytes, groupInfoBytes)
    })

    it('should fetch group info using the qualified conversation', async () => {
      await processor.process(makeEvent())

      expect(conversationService.getConversationGroupInfo).toHaveBeenCalledTimes(1)
      expect(conversationService.getConversationGroupInfo).toHaveBeenCalledWith(qualifiedConversation)
    })

    it('should fetch the conversation by qualified id after processing welcome', async () => {
      await processor.process(makeEvent())

      expect(conversationService.fetchConversationById).toHaveBeenCalledTimes(1)
      expect(conversationService.fetchConversationById).toHaveBeenCalledWith(qualifiedConversation)
    })

    it('should save the conversation with members', async () => {
      const conversationResponse = {team: 'team-1', group_id: 'mls-group-id'}
      vi.mocked(conversationService.fetchConversationById).mockResolvedValue(conversationResponse as any)

      await processor.process(makeEvent())

      expect(conversationService.saveConversationWithMembers).toHaveBeenCalledTimes(1)
      expect(conversationService.saveConversationWithMembers).toHaveBeenCalledWith(qualifiedConversation, conversationResponse)
    })

    it('should notify wireEventsHandler with the mapped conversation and members', async () => {
      const conversation = makeConversation()
      const members = makeMembers()
      vi.mocked(ConversationMapper.fromEntity).mockReturnValue(conversation as any)
      vi.mocked(conversationService.saveConversationWithMembers).mockResolvedValue({
        conversation: makeConversationEntity() as any,
        members,
      })

      await processor.process(makeEvent())

      expect(wireEventsHandler.onAppAddedToConversation).toHaveBeenCalledTimes(1)
      expect(wireEventsHandler.onAppAddedToConversation).toHaveBeenCalledWith(conversation, members)
    })

    describe('key package upload', () => {
      it('should not upload key packages when hasTooFewKeyPackageCount is false', async () => {
        vi.mocked(coreCryptoService.hasTooFewKeyPackageCount).mockResolvedValue(false)

        await processor.process(makeEvent())

        expect(coreCryptoService.mlsGenerateKeyPackages).not.toHaveBeenCalled()
        expect(mlsService.uploadMlsKeyPackages).not.toHaveBeenCalled()
      })

      it('should not upload key packages when device id is not stored', async () => {
        vi.mocked(coreCryptoService.hasTooFewKeyPackageCount).mockResolvedValue(true)
        vi.mocked(appProperties.getDeviceId).mockReturnValue(undefined)

        await processor.process(makeEvent())

        expect(mlsService.uploadMlsKeyPackages).not.toHaveBeenCalled()
      })

      it('should generate and upload key packages when count is low and device id is stored', async () => {
        vi.mocked(coreCryptoService.hasTooFewKeyPackageCount).mockResolvedValue(true)

        await processor.process(makeEvent())

        expect(coreCryptoService.mlsGenerateKeyPackages).toHaveBeenCalledTimes(1)
        expect(mlsService.uploadMlsKeyPackages).toHaveBeenCalledTimes(1)
        expect(mlsService.uploadMlsKeyPackages).toHaveBeenCalledWith(keyPackages)
      })
    })

    it('should resolve without a value on success', async () => {
      await expect(processor.process(makeEvent())).resolves.toBeUndefined()
    })
  })
})
