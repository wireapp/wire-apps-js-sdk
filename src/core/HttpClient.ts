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

import type { AccessResponse } from "../api/response/AccessResponse.js"
import { WIRE_API_HOST, WIRE_USER_EMAIL, WIRE_USER_PASSWORD } from "../utils/DependencyInjectionTokens.js"
import type { WireApiError } from "../model/exception/WireApiError.js"
import { inject, singleton } from "tsyringe"

@singleton()
export class HttpClient {

  private tokenTimestamp: number | null = null
  private cachedAccessToken: string | null = null
  private cachedDeviceId: string | null = null
  private headers: Record<string, string> = {
    "Content-Type": "application/json"
  }

  constructor(
    @inject(WIRE_API_HOST) private apiHost: string,
    @inject(WIRE_USER_EMAIL) private wireUserEmail: string,
    @inject(WIRE_USER_PASSWORD) private wireUserPassword: string
  ) {}
  
  private setAuthorizationToken(token: string) {
    this.headers["Authorization"] = `Bearer ${token}`
  }

  getApiHostVersion(): string {
    return this.API_HOST_VERSION
  }

  getCachedAccessToken(): string {
    if (!this.cachedAccessToken) {
      console.error("No cached access token found.")
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
      console.error("No cached deviceId found.")
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

      console.log("Access token expired, getting a new one.")
    }

    // TODO: Move to Token retrieval once backend tickets are done.
    const loginResponse = (await this.request<Record<string, unknown>>("login", {
      method: "POST",
      body: JSON.stringify({
        email: this.wireUserEmail,
        password: this.wireUserPassword
      }),
      headers: {
        "Content-Type": this.HEADER_DEFAULT_CONTENT_TYPE,
      }
    }))

    if (this.cachedDeviceId != null) {
      const setCookieHeaders: string[] = loginResponse.response.headers.getSetCookie();
      const zuidCookie = setCookieHeaders
        ?.find((cookie: string) => cookie.startsWith('zuid='))
        ?.split(';')[0];

      const path = this.cachedDeviceId
        ? `access?client_id=${this.cachedDeviceId}`
        : `access`
      const jsonAccessResponse = (await this.request<Record<string, unknown>>(path, {
        method: "POST",
        headers: {
          "Cookie": `${zuidCookie}`
        }
      })).data

      const accessResponse: AccessResponse = {
        accessToken: jsonAccessResponse["access_token"] as string,
        expiresIn: jsonAccessResponse["expires_in"] as number
      }

      this.cachedAccessToken = accessResponse.accessToken
      this.tokenTimestamp = currentTime

      this.setAuthorizationToken(accessResponse.accessToken)
    } else {
      this.setAuthorizationToken(loginResponse.data["access_token"] as string)
    }
  }

  async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<{ data: T; response: Response }> {
    const optionsAndHeaders = {
      ...options,
      headers: {
        ...this.headers,
        ...(options.headers || {})
      }
    }
    const response = await fetch(`${this.apiHost}/${this.API_HOST_VERSION}/${path}`, optionsAndHeaders)

    if (!response.ok) {
      let errorDetails = ''

      try {
        const contentType = response.headers.get("content-type")
        if (contentType?.includes("application/json")) {
          const errorBody = await response.json() as Partial<WireApiError>
          if (errorBody.label && errorBody.message) {
            console.error(`API Error - Label: ${errorBody.label}, Message: ${errorBody.message}`)
            errorDetails = ` [${errorBody.label}]: ${errorBody.message}`
          }
        }
      } catch (exception) {
        console.error(`Could not parse error response: ${exception}`)
      }

      // TODO: Map to WireException
      throw new Error(`HTTP ${response.status} for ${path}${errorDetails || ': ' + response.statusText}`)
    }

    const contentType = response.headers.get("content-type")
    if (contentType?.includes("application/json")) {
      const data = await response.json() as T
      return { data, response };
    }
    return { data: undefined as unknown as T, response }
  }

  async getRequest<T>(
    path: string,
    headerContentType: string = this.HEADER_DEFAULT_CONTENT_TYPE,
    headerAccept: string = this.HEADER_DEFAULT_ACCEPT
  ): Promise<T> {
    await this.verifyAuthorizationToken()
    return (await this.request<T>(path, {
      method: "GET",
      headers: {
        "Content-Type": headerContentType,
        "Accept": headerAccept
      }
    })).data
  }

  async postRequest<T>(
    path: string,
    body: unknown,
    headerContentType: string = this.HEADER_DEFAULT_CONTENT_TYPE,
    headerAccept: string = this.HEADER_DEFAULT_ACCEPT
  ): Promise<T> {
    await this.verifyAuthorizationToken()

    const isBinary = body instanceof Uint8Array || body instanceof ArrayBuffer;
    const requestBody = isBinary ? body as BodyInit : JSON.stringify(body);

    return (await this.request<T>(path, {
      method: "POST",
      body: requestBody,
      headers: {
        "Content-Type": headerContentType,
        "Accept": headerAccept
      }
    })).data
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

  private API_HOST_VERSION: string = "v12"
  private TOKEN_EXPIRATION_MS = 14 * 60 * 1000 // 14 minutes in milliseconds
  private HEADER_DEFAULT_CONTENT_TYPE = "application/json"
  private HEADER_DEFAULT_ACCEPT = "application/json"
}
