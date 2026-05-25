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

import {WIRE_API_HOST, WIRE_SDK_API_TOKEN} from "../utils/DependencyInjectionTokens.js"
import type {WireApiError} from "../model/exception/WireApiError.js"
import {inject, singleton} from "tsyringe"
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";

@singleton()
export class HttpClient {
  private logger = LoggerFactory.getLogger(this.constructor.name)
  private tokenTimestamp: number | null = null
  private cachedAccessToken: string | null = null
  private cachedDeviceId: string | null = null
  private headers: Record<string, string> = {
    "Content-Type": "application/json"
  }

  constructor(
    @inject(WIRE_API_HOST) private wireApiHost: string,
    @inject(WIRE_SDK_API_TOKEN) private apiToken: string
  ) {}

  private setAuthorizationToken(token: string) {
    this.headers["Authorization"] = `Bearer ${token}`
  }

  clearAuthorizationToken() {
    this.cachedAccessToken = null
  }

  getApiHostVersion(): string {
    return this.API_HOST_VERSION
  }

  getCachedAccessToken(): string {
    if (!this.cachedAccessToken) {
      this.logger.error("No cached access token found.")
      // TODO: Map to WireException
      throw new Error("No cached access token found.")
    }
    return this.cachedAccessToken!
  }

  setDeviceId(deviceId: string) {
    this.cachedDeviceId = deviceId
  }

  getCachedDeviceId(): string {
    if (!this.cachedDeviceId) {
      this.logger.error("No cached deviceId found.")
      // TODO: Map to WireException
      throw new Error("No cached deviceId found.")
    }
    return this.cachedDeviceId!
  }

  async verifyAuthorizationToken() {
    const currentTime = Date.now()

    // Check if token is valid (not null and not expired)
    if (this.cachedAccessToken != null && this.tokenTimestamp != null) {
      const timeSinceTokenIssued = currentTime - this.tokenTimestamp
      if (timeSinceTokenIssued < this.TOKEN_EXPIRATION_MS) {
        this.setAuthorizationToken(this.cachedAccessToken)
        return
      }

      this.logger.info("Access token expired, getting a new one.")
    }

    const path = this.cachedDeviceId
      ? `access?client_id=${this.cachedDeviceId}`
      : `access`
    const accessResponse = (await this.request<Record<string, unknown>>(path, {
      method: "POST",
      headers: {
        "Cookie": `zuid=${this.apiToken}` // TODO: cookie will change therefore new variable needs to be introduced
      }
    }))

    // TODO: save new cookie
    // const setCookieHeaders: string[] = accessResponse.response.headers.getSetCookie();
    // const zuidCookie = setCookieHeaders
    //   ?.find((cookie: string) => cookie.startsWith('zuid='))
    //   ?.split(';')[0];

    const accessToken = accessResponse.data['access_token'] as string

    this.cachedAccessToken = accessToken
    this.tokenTimestamp = currentTime

    this.setAuthorizationToken(accessToken)
  }

  async request<T>(
    path: string,
    options: RequestInit = {},
    includeApiVersion: boolean = true
  ): Promise<{ data: T; response: Response }> {
    const optionsAndHeaders = {
      ...options,
      headers: {
        ...this.headers,
        ...(options.headers || {})
      }
    }
    const url = [
      this.wireApiHost,
      includeApiVersion ? this.API_HOST_VERSION : null,
      path
    ].filter(Boolean).join("/")
    const response = await fetch(url, optionsAndHeaders)

    if (!response.ok) {
      let errorDetails = ''

      try {
        const contentType = response.headers.get("content-type")
        if (contentType?.includes("application/json")) {
          const errorBody = await response.json() as Partial<WireApiError>
          if (errorBody.label && errorBody.message) {
            this.logger.error(`API Error - Label: ${errorBody.label}, Message: ${errorBody.message}`)
            errorDetails = ` [${errorBody.label}]: ${errorBody.message}`
          }
        }
      } catch (exception) {
        this.logger.error(`Could not parse error response: ${exception}`)
      }

      // TODO: Map to WireException
      throw new Error(`HTTP ${response.status} for ${path}${errorDetails || ': ' + response.statusText}`)
    }

    const contentType = response.headers.get("content-type")

    if (contentType?.includes("application/json")) {
      const data = await response.json() as T
      return { data, response };
    }

    if (contentType?.includes("message/mls") || contentType?.includes("octet-stream")) {
      const arrayBuffer = await response.arrayBuffer()
      const data = new Uint8Array(arrayBuffer) as T
      return { data, response };
    }

    return { data: undefined as unknown as T, response }
  }

  async getRequest<T>(
    path: string,
    options?: {
      headerContentType?: string;
      headerAccept?: string;
      includeApiVersion?: boolean;
      additionalHeaders?: Record<string, string>
    }
  ): Promise<T> {
    await this.verifyAuthorizationToken()

    const {
      headerContentType = this.HEADER_DEFAULT_CONTENT_TYPE,
      headerAccept = this.HEADER_DEFAULT_ACCEPT,
      includeApiVersion = true,
      additionalHeaders = {}
    } = options ?? {}

    const requestConfig = {
      method: "GET",
      headers: {
        "Content-Type": headerContentType,
        "Accept": headerAccept,
        ...additionalHeaders
      }
    }
    return (await this.request<T>(path, requestConfig, includeApiVersion)).data
  }

  async postRequest<T>(
    path: string,
    body?: unknown,
    options?: {
      headerContentType?: string;
      headerAccept?: string;
      includeApiVersion?: boolean;
    }
  ): Promise<T> {
    await this.verifyAuthorizationToken()

    const {
      headerContentType = this.HEADER_DEFAULT_CONTENT_TYPE,
      headerAccept = this.HEADER_DEFAULT_ACCEPT,
      includeApiVersion = true,
    } = options ?? {}

    const isBinary = body instanceof Uint8Array || body instanceof ArrayBuffer
    const requestBody = body
      ? (isBinary ? body as BodyInit : JSON.stringify(body))
      : null

    const requestConfig = {
      method: "POST",
      body: requestBody,
      headers: {
        "Content-Type": headerContentType,
        "Accept": headerAccept
      }
    }
    return (await this.request<T>(path, requestConfig, includeApiVersion)).data
  }

  async putRequest<T>(
    path: string,
    body: unknown,
    headerContentType: string = this.HEADER_DEFAULT_CONTENT_TYPE,
    headerAccept: string = this.HEADER_DEFAULT_ACCEPT
  ): Promise<T> {
    await this.verifyAuthorizationToken()
    return (await this.request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": headerContentType,
        "Accept": headerAccept
      }
    })).data
  }

  async deleteRequest<T>(
    path: string,
    body?: unknown,
    options?: {
      headerContentType?: string;
      headerAccept?: string;
    }
  ): Promise<T> {
    await this.verifyAuthorizationToken()

    const {
      headerContentType = this.HEADER_DEFAULT_CONTENT_TYPE,
      headerAccept = this.HEADER_DEFAULT_ACCEPT
    } = options ?? {}

    const isBinary = body instanceof Uint8Array || body instanceof ArrayBuffer
    const requestBody = body
      ? (isBinary ? body as BodyInit : JSON.stringify(body))
      : null

    return (await this.request<T>(path, {
      method: "DELETE",
      ...(requestBody && { body: requestBody }),
      headers: {
        "Content-Type": headerContentType,
        "Accept": headerAccept
      }
    })).data
  }

  private API_HOST_VERSION: string = "v15"
  private TOKEN_EXPIRATION_MS = 14 * 60 * 1000 // 14 minutes in milliseconds
  private HEADER_DEFAULT_CONTENT_TYPE = "application/json"
  private HEADER_DEFAULT_ACCEPT = "application/json"
}
