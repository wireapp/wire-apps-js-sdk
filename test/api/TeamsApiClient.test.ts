import {beforeEach, describe, expect, it, vi} from 'vitest'
import {TeamId} from '../../src/model/TeamId.js'
import {TeamsApiClient} from '../../src/api/TeamsApiClient.js'

describe('TeamsApiClient (deleteConversation)', () => {
  let mockHttpClient: any
  let client: TeamsApiClient

  beforeEach(() => {
    mockHttpClient = {
      deleteRequest: vi.fn()
    }

    client = new TeamsApiClient(mockHttpClient)

    // Suppress console.info for cleaner test output (many clients log)
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  it('should call httpClient.deleteRequest with the correct path', async () => {
    vi.mocked(mockHttpClient.deleteRequest).mockResolvedValue(undefined)

    const teamId = new TeamId('team-1')
    const conversationId = {id: 'conv-1', domain: 'example.com'}

    await client.deleteConversation(teamId, conversationId)

    expect(mockHttpClient.deleteRequest).toHaveBeenCalledWith('teams/team-1/conversations/conv-1')
  })

  it('should propagate errors from httpClient.deleteRequest', async () => {
    vi.mocked(mockHttpClient.deleteRequest).mockRejectedValue(new Error('network-failure'))

    const teamId = new TeamId('team-1')
    const conversationId = {id: 'conv-1', domain: 'example.com'}

    await expect(client.deleteConversation(teamId, conversationId)).rejects.toThrow('network-failure')
  })
})
