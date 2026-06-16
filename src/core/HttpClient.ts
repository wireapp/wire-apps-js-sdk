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

import {WIRE_API_HOST} from "../utils/DependencyInjectionTokens.js"
import type {WireApiError} from "../model/exception/WireApiError.js"
import {inject, singleton} from "tsyringe"
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";
import {AppProperties} from "../service/AppProperties.js";
import {WireApiException} from "../model/exception/WireApiException.js";
import type {AccessResponse} from "../api/response/AccessResponse.js";

@singleton()
export class HttpClient {
  private logger = LoggerFactory.getLogger(this.constructor.name)
  private cachedAccessToken: string | null = null
  private cachedDeviceId: string | null = null
  private headers: Record<string, string> = {
    "Content-Type": "application/json"
  }

  constructor(
    @inject(WIRE_API_HOST) private wireApiHost: string,
    private appProperties: AppProperties
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

  async refreshAccessToken() {
    try {
      await this.obtainAccessToken()
    } catch (exception) {
      this.logger.error('Unable to retrieve access token, Error:', exception)
      if (exception instanceof WireApiException && exception.isCredentialsInvalid()) {
        this.appProperties.deleteBackendCookie()

        // TODO: Map to WireException
        throw new Error("Current cookie/api-token is expired. Get a new apiToken and restart the App")
      }
    }
  }

  private async obtainAccessToken() {
    const path = this.cachedDeviceId
      ? `access?client_id=${this.cachedDeviceId}`
      : `access`

    const accessResponse = (await this.request<AccessResponse>(path, {
      method: "POST",
      headers: {
        "Cookie": `zuid=${this.appProperties.getBackendCookie()}`
      }
    }))

    const setCookieHeaders: string[] = accessResponse.response.headers.getSetCookie();
    const zuidCookie = setCookieHeaders
      ?.find((cookie: string) => cookie.startsWith('zuid='))
      ?.split(';')[0]
      ?.slice(5); // remove "zuid="
    if (zuidCookie)
      this.appProperties.saveBackendCookie(zuidCookie)

    const accessToken = accessResponse.data.access_token

    this.cachedAccessToken = accessToken

    this.setAuthorizationToken(accessToken)
  }

  async request<T>(
    path: string,
    options: RequestInit = {},
    includeApiVersion: boolean = true,
    isRetry: boolean = false
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
      if (response.status == 401 && !isRetry) {
        this.logger.info("Access token not valid, getting a new one.")
        await this.refreshAccessToken()
        return this.request(path, options, includeApiVersion, true)
      }
      let standardError: WireApiError | undefined

      const contentType = response.headers.get("content-type")
      if (contentType?.includes("application/json")) {
        try {
          standardError = await response.json() as WireApiError
        } catch (exception) {
          this.logger.error(`Could not parse error response: ${exception}`)
        }
      }

      if (standardError?.label && standardError?.message) {
        this.logger.error(`WireApiException - Label: ${standardError.label}, Message: ${standardError.message}`)
        throw new WireApiException(standardError)
      }

      // TODO: Map to WireException
      throw new Error(`HTTP ${response.status} for ${path}: ${response.statusText}`)
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
  private HEADER_DEFAULT_CONTENT_TYPE = "application/json"
  private HEADER_DEFAULT_ACCEPT = "application/json"
}
