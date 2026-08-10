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
import type {WireApiError} from "../exception/WireApiError.js"
import {inject, singleton} from "tsyringe"
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";
import {AppProperties} from "../service/AppProperties.js";
import {WireApiException} from "../exception/WireApiException.js";
import type {AccessResponse} from "../api/response/AccessResponse.js";
import {HTTP_RETRY_POLICY} from "./HttpRetryPolicy.js";
import {
  calculateHttpRetryDelay,
  isRetryableHttpError,
  isRetryableHttpStatus,
  RetryableHttpStatusError,
  RetryableNetworkError,
  waitForHttpRetry
} from "./HttpRetryHelper.js";
import {UnknownError} from "../exception/WireException.js";

@singleton()
export class HttpClient {
  private logger = LoggerFactory.getLogger(this.constructor.name)
  private cachedAccessToken: string | null = null
  private accessTokenRefreshLock: Promise<void> | null = null;
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
      throw new UnknownError("No cached access token found.")
    }
    return this.cachedAccessToken!
  }

  async refreshAccessToken() {
    if (this.accessTokenRefreshLock) {
      return this.accessTokenRefreshLock
    }

    this.accessTokenRefreshLock = this.updateAccessToken().finally(() => {
      this.accessTokenRefreshLock = null
    })

    return this.accessTokenRefreshLock
  }

  private persistBackendCookie(setCookieHeader: string[]) {
    const zuidCookie = setCookieHeader
      ?.find((cookie: string) => cookie.startsWith('zuid='))
      ?.split(';')[0]
      ?.slice(5); // remove "zuid="
    if (zuidCookie)
      this.appProperties.saveBackendCookie(zuidCookie)
  }

  private async updateAccessToken() {
    try {
      this.logger.info('Obtaining new access token')
      const accessResponse = await this.fetchAccessToken()
      this.persistBackendCookie(accessResponse.response.headers.getSetCookie())

      const accessToken = accessResponse.data.access_token

      this.cachedAccessToken = accessToken

      this.setAuthorizationToken(accessToken)
    } catch (exception) {
      this.logger.error('Unable to retrieve access token, Error:', exception)
      if (exception instanceof WireApiException && exception.isCredentialsInvalid()) {
        this.appProperties.deleteBackendCookie()

        throw new UnknownError("Current cookie/api-token is expired. Get a new apiToken and restart the App")
      }
      throw exception
    }
  }

  private async fetchAccessToken() {
    const path = this.appProperties.hasDeviceId()
      ? `access?client_id=${this.appProperties.getDeviceId()}`
      : `access`

    return this.request<AccessResponse>(
      path, {
        method: "POST",
        headers: {
          "Cookie": `zuid=${this.appProperties.getBackendCookie()}`
        }
      },
      true,
      false
    )
  }

  async request<T>(
    path: string,
    options: RequestInit = {},
    includeApiVersion: boolean = true,
    shouldRetry: boolean = true
  ): Promise<{ data: T; response: Response }> {
    return this.withRetry(
      shouldRetryOnStatus => this.requestOnce<T>(
        path,
        options,
        includeApiVersion,
        shouldRetry,
        shouldRetryOnStatus
      ),
      path
    )
  }

  private async requestOnce<T>(
    path: string,
    options: RequestInit,
    includeApiVersion: boolean,
    shouldRetryUnauthorized: boolean,
    shouldRetryOnStatus: boolean
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
    let response: Response
    try {
      response = await fetch(url, optionsAndHeaders)
    } catch (exception) {
      throw new RetryableNetworkError(path, exception)
    }

    if (!response.ok) {
      if (response.status === 401 && shouldRetryUnauthorized) {
        this.logger.info("Access token not valid, getting a new one.")
        await this.refreshAccessToken()
        return this.requestOnce(path, options, includeApiVersion, false, shouldRetryOnStatus)
      }

      if (shouldRetryOnStatus && isRetryableHttpStatus(response.status)) {
        await response.arrayBuffer().catch(() => undefined)
        throw new RetryableHttpStatusError(response.status, path)
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

      throw new UnknownError(`HTTP ${response.status} for ${path}: ${response.statusText}`)
      //TODO: Maybe more clear error type?
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

  private async withRetry<T>(
    operation: (shouldRetryOnStatus: boolean) => Promise<T>,
    path: string
  ): Promise<T> {
    const retryPolicy = HTTP_RETRY_POLICY
    const maxAttempts = retryPolicy.maxAttempts

    for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex++) {
      const shouldRetryOnStatus = attemptIndex < maxAttempts - 1

      try {
        return await operation(shouldRetryOnStatus)
      } catch (exception) {
        if (attemptIndex >= maxAttempts - 1 || !isRetryableHttpError(exception)) {
          throw exception
        }

        const delayMs = calculateHttpRetryDelay(retryPolicy, attemptIndex + 1)
        this.logger.warn(
          `Retrying HTTP request for ${path} in ${delayMs}ms ` +
          `(attempt ${attemptIndex + 2}/${maxAttempts})`
        )
        await waitForHttpRetry(delayMs)
      }
    }

    throw new UnknownError(`HTTP request failed for ${path}`)
    //TODO: Maybe more clear error type?
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
    options?: {
      headerContentType?: string;
      headerAccept?: string;
    }
  ): Promise<T> {
    const {
      headerContentType = this.HEADER_DEFAULT_CONTENT_TYPE,
      headerAccept = this.HEADER_DEFAULT_ACCEPT,
    } = options ?? {}

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
      headerAccept = this.HEADER_DEFAULT_ACCEPT,
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
