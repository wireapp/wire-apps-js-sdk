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

import {beforeEach, describe, expect, it, vi} from "vitest";
import {AssetsApiClient} from "../../src/api/AssetsApiClient.js";
import type {AssetUploadData} from "../../src/api/model/asset/AssetUploadData.js";
import type {AssetUploadResponse} from "../../src/api/model/asset/AssetUploadResponse.js";

vi.mock("crypto", () => ({
  randomUUID: vi.fn(() => "test-uuid-1234"),
}));

vi.mock("../../src/utils/BufferUtils.js", () => ({
  concatToBuffer: vi.fn((...parts: string[]) => Buffer.from(parts.join(""))),
}));

describe("AssetsApiClient", () => {
  let mockHttpClient: any;
  let client: AssetsApiClient;

  beforeEach(() => {
    vi.clearAllMocks()
    mockHttpClient = {
      getRequest: vi.fn(),
      postRequest: vi.fn(),
    };

    client = new AssetsApiClient(mockHttpClient);

    vi.spyOn(console, "info").mockImplementation(() => {
    });
  });

  describe("downloadAsset", () => {
    const assetId = "asset-123";
    const assetDomain = "example.com";
    const mockAssetData = new Uint8Array([1, 2, 3]);

    it("should call getRequest with the correct path", async () => {
      vi.mocked(mockHttpClient.getRequest).mockResolvedValue(mockAssetData);

      await client.downloadAsset(assetId, assetDomain);

      expect(mockHttpClient.getRequest).toHaveBeenCalledWith(
        `assets/${assetDomain}/${assetId}`,
        expect.objectContaining({additionalHeaders: {}})
      );
    });

    it("should include Asset-Token header when assetToken is provided", async () => {
      vi.mocked(mockHttpClient.getRequest).mockResolvedValue(mockAssetData);

      await client.downloadAsset(assetId, assetDomain, "my-secret-token");

      expect(mockHttpClient.getRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          additionalHeaders: {"Asset-Token": "my-secret-token"},
        })
      );
    });

    it("should omit Asset-Token header when assetToken is null", async () => {
      vi.mocked(mockHttpClient.getRequest).mockResolvedValue(mockAssetData);

      await client.downloadAsset(assetId, assetDomain, null);

      expect(mockHttpClient.getRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({additionalHeaders: {}})
      );
    });

    it("should omit Asset-Token header when assetToken is undefined", async () => {
      vi.mocked(mockHttpClient.getRequest).mockResolvedValue(mockAssetData);

      await client.downloadAsset(assetId, assetDomain, undefined);

      expect(mockHttpClient.getRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({additionalHeaders: {}})
      );
    });

    it("should return the asset data from getRequest", async () => {
      vi.mocked(mockHttpClient.getRequest).mockResolvedValue(mockAssetData);

      const result = await client.downloadAsset(assetId, assetDomain);

      expect(result).toBe(mockAssetData);
    });

    it("should propagate errors from getRequest", async () => {
      vi.mocked(mockHttpClient.getRequest).mockRejectedValue(new Error("Network error"));

      await expect(client.downloadAsset(assetId, assetDomain)).rejects.toThrow("Network error");
    });
  });

  describe("uploadAsset", () => {
    const mockAsset = new Uint8Array([10, 20, 30]);
    const mockUploadData: AssetUploadData = {
      public: false,
      retention: "persistent",
    };
    const mockUploadResponse: AssetUploadResponse = {
      key: "3-1-abc123",
      domain: "example.com",
      token: "upload-token",
    };

    it("should call postRequest with the correct base path", async () => {
      vi.mocked(mockHttpClient.postRequest).mockResolvedValue(mockUploadResponse);

      await client.uploadAsset(mockAsset, mockUploadData);

      expect(mockHttpClient.postRequest).toHaveBeenCalledWith(
        "assets",
        expect.anything(),
        expect.anything()
      );
    });

    it("should call postRequest with multipart/mixed content type using the generated boundary", async () => {
      vi.mocked(mockHttpClient.postRequest).mockResolvedValue(mockUploadResponse);

      await client.uploadAsset(mockAsset, mockUploadData);

      expect(mockHttpClient.postRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          headerContentType: "multipart/mixed; boundary=Frontiertest-uuid-1234",
        })
      );
    });

    it("should include serialized metadata in the multipart body", async () => {
      const {concatToBuffer} = await import("../../src/utils/BufferUtils.js");
      vi.mocked(mockHttpClient.postRequest).mockResolvedValue(mockUploadResponse);

      await client.uploadAsset(mockAsset, mockUploadData);

      const [firstCall] = vi.mocked(concatToBuffer).mock.calls;
      expect(firstCall).toBeDefined();
      const bodyArg = firstCall![0] as string;
      expect(bodyArg).toContain(JSON.stringify(mockUploadData));
    });

    it("should pass the asset data as the middle argument to concatToBuffer", async () => {
      const {concatToBuffer} = await import("../../src/utils/BufferUtils.js");
      vi.mocked(mockHttpClient.postRequest).mockResolvedValue(mockUploadResponse);

      await client.uploadAsset(mockAsset, mockUploadData);

      const [firstCall] = vi.mocked(concatToBuffer).mock.calls;
      expect(firstCall).toBeDefined();
      expect(firstCall![1]).toBe(mockAsset);
    });

    it("should return the upload response from postRequest", async () => {
      vi.mocked(mockHttpClient.postRequest).mockResolvedValue(mockUploadResponse);

      const result = await client.uploadAsset(mockAsset, mockUploadData);

      expect(result).toBe(mockUploadResponse);
    });

    it("should propagate errors from postRequest", async () => {
      vi.mocked(mockHttpClient.postRequest).mockRejectedValue(new Error("Upload failed"));

      await expect(client.uploadAsset(mockAsset, mockUploadData)).rejects.toThrow("Upload failed");
    });
  });
});
