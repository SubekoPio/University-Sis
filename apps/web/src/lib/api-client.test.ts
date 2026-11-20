// Purpose: Test browser token attachment and refresh-once behavior.
// Used by: The web package Vitest suite.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiRequest,
  changeTemporaryPassword,
  getCurrentAuthUser,
  getPasswordChangeNotice,
  login,
  type AuthResult,
} from "./api-client";

const SESSION_STORAGE_KEY = "university-sis.auth-session";
const storedValues = new Map<string, string>();
const sessionStorageMock = {
  getItem: vi.fn((key: string) => storedValues.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storedValues.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    storedValues.delete(key);
  }),
};
const windowMock = {
  sessionStorage: sessionStorageMock,
  dispatchEvent: vi.fn(() => true),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};
const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

/**
 * Creates a valid auth session response for API-client tests.
 *
 * @param accessToken - Access token saved by the client.
 * @param refreshToken - Refresh token saved by the client.
 * @returns A complete auth response that passes the API client guard.
 */
function createAuthResult(
  accessToken: string,
  refreshToken: string,
  mustChangePassword?: boolean,
): AuthResult {
  return {
    accessToken,
    refreshToken,
    tokenType: "Bearer",
    expiresIn: 900,
    user: {
      id: "user-1",
      email: "student@example.edu",
      status: "ACTIVE",
      emailVerified: true,
      ...(mustChangePassword === undefined ? {} : { mustChangePassword }),
    },
  };
}

/**
 * Creates a JSON response for mocked fetch calls.
 *
 * @param body - Response payload serialized as JSON.
 * @param status - HTTP response status.
 * @returns A fetch-compatible JSON response.
 */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Creates an unauthorized response for protected-resource requests.
 *
 * @returns A fetch-compatible 401 response.
 */
function unauthorizedResponse(): Response {
  return jsonResponse({ message: "Unauthorized" }, 401);
}

describe("apiRequest authentication", () => {
  beforeEach(() => {
    storedValues.clear();
    sessionStorageMock.getItem.mockClear();
    sessionStorageMock.setItem.mockClear();
    sessionStorageMock.removeItem.mockClear();
    fetchMock.mockReset();
    windowMock.dispatchEvent.mockClear();
    windowMock.addEventListener.mockClear();
    windowMock.removeEventListener.mockClear();
    vi.stubGlobal("window", windowMock);
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("attaches the stored access token to a protected request", async () => {
    sessionStorageMock.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(createAuthResult("access-old", "refresh-old")),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "record-1" }));

    await expect(apiRequest<{ id: string }>("/protected")).resolves.toEqual({
      id: "record-1",
    });

    const requestHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(requestHeaders.get("Authorization")).toBe("Bearer access-old");
  });

  it("refreshes after 401 and retries the protected request once", async () => {
    sessionStorageMock.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(createAuthResult("access-old", "refresh-old")),
    );
    fetchMock
      .mockResolvedValueOnce(unauthorizedResponse())
      .mockResolvedValueOnce(jsonResponse(createAuthResult("access-new", "refresh-new")))
      .mockResolvedValueOnce(jsonResponse({ id: "record-1" }));

    await expect(apiRequest<{ id: string }>("/protected")).resolves.toEqual({
      id: "record-1",
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("http://localhost:3001/auth/refresh");
    const retryHeaders = new Headers(fetchMock.mock.calls[2]?.[1]?.headers);
    expect(retryHeaders.get("Authorization")).toBe("Bearer access-new");
    const storedSession: unknown = JSON.parse(storedValues.get(SESSION_STORAGE_KEY) ?? "null");
    expect(storedSession).toEqual(createAuthResult("access-new", "refresh-new"));
  });

  it("does not refresh or retry again when the retried request is unauthorized", async () => {
    sessionStorageMock.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(createAuthResult("access-old", "refresh-old")),
    );
    fetchMock
      .mockResolvedValueOnce(unauthorizedResponse())
      .mockResolvedValueOnce(jsonResponse(createAuthResult("access-new", "refresh-new")))
      .mockResolvedValueOnce(unauthorizedResponse());

    await expect(apiRequest("/protected")).rejects.toMatchObject({
      status: 401,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("shares one refresh request between concurrent unauthorized requests", async () => {
    sessionStorageMock.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(createAuthResult("access-old", "refresh-old")),
    );
    let refreshCalls = 0;
    const protectedRequestCounts = new Map<string, number>();
    let releaseRefresh: () => void = () => {};
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });

    fetchMock.mockImplementation(async (input) => {
      const requestUrl = String(input);
      if (requestUrl.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        await refreshGate;
        return jsonResponse(createAuthResult("access-new", "refresh-new"));
      }
      if (requestUrl.endsWith("/protected/one") || requestUrl.endsWith("/protected/two")) {
        const requestCount = (protectedRequestCounts.get(requestUrl) ?? 0) + 1;
        protectedRequestCounts.set(requestUrl, requestCount);
        return requestCount === 1 ? unauthorizedResponse() : jsonResponse({ ok: true });
      }
      return jsonResponse({ ok: true });
    });

    const requests = Promise.all([
      apiRequest<{ ok: boolean }>("/protected/one"),
      apiRequest<{ ok: boolean }>("/protected/two"),
    ]);

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(refreshCalls).toBe(1);
    releaseRefresh();
    await expect(requests).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(refreshCalls).toBe(1);
  });

  it("uses the login password-change flag without refreshing the session", async () => {
    const forcedChangeResult = createAuthResult("temporary-access", "temporary-refresh", true);
    fetchMock.mockResolvedValueOnce(jsonResponse(forcedChangeResult));

    await expect(
      login({ email: "student@example.edu", password: "temporary-password" }),
    ).resolves.toEqual(forcedChangeResult);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getCurrentAuthUser()?.mustChangePassword).toBe(true);
  });

  it("probes the server gate when a successful login omits the password-change flag", async () => {
    const refreshedResult = createAuthResult("access-refreshed", "refresh-refreshed");
    fetchMock
      .mockResolvedValueOnce(jsonResponse(createAuthResult("access-login", "refresh-login")))
      .mockResolvedValueOnce(jsonResponse(refreshedResult));

    await expect(
      login({ email: "student@example.edu", password: "correct-password" }),
    ).resolves.toEqual(refreshedResult);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("http://localhost:3001/auth/refresh");
    expect(getCurrentAuthUser()?.mustChangePassword).toBeUndefined();
  });

  it("detects a required password change from the API gate when login omits its flag", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(createAuthResult("access", "refresh")))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            code: "MUST_CHANGE_PASSWORD",
            message: "Change your temporary password before accessing this endpoint.",
          },
          403,
        ),
      );

    await expect(
      login({ email: "student@example.edu", password: "temporary-password" }),
    ).rejects.toMatchObject({ code: "MUST_CHANGE_PASSWORD" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getCurrentAuthUser()?.mustChangePassword).toBe(true);
    expect(getPasswordChangeNotice()).toBe(
      "Change your temporary password before accessing this endpoint.",
    );
  });

  it("marks an existing session for password change when a protected API request requires it", async () => {
    sessionStorageMock.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(createAuthResult("access-old", "refresh-old")),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          code: "MUST_CHANGE_PASSWORD",
          message: "Your temporary password has expired. Contact an administrator.",
        },
        403,
      ),
    );

    await expect(apiRequest("/protected")).rejects.toMatchObject({
      code: "MUST_CHANGE_PASSWORD",
    });

    expect(getCurrentAuthUser()?.mustChangePassword).toBe(true);
    expect(getPasswordChangeNotice()).toBe(
      "Your temporary password has expired. Contact an administrator.",
    );
  });

  it("clears the forced-change flag and notice after a successful password change", async () => {
    sessionStorageMock.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(createAuthResult("access-current", "refresh-current", true)),
    );
    sessionStorageMock.setItem(
      "university-sis.password-change-notice",
      "Change your temporary password before accessing this endpoint.",
    );
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Password changed successfully." }));

    await expect(
      changeTemporaryPassword({
        currentPassword: "temporary-password",
        newPassword: "replacement-password",
      }),
    ).resolves.toEqual({ message: "Password changed successfully." });

    expect(getCurrentAuthUser()?.mustChangePassword).toBe(false);
    expect(getPasswordChangeNotice()).toBeNull();
    const requestHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(requestHeaders.get("Authorization")).toBe("Bearer access-current");
  });

  it("preserves the administrator-contact message for an expired login password", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          code: "UNAUTHORIZED",
          message: "Your temporary password has expired. Contact an administrator.",
        },
        401,
      ),
    );

    await expect(
      login({ email: "student@example.edu", password: "temporary-password" }),
    ).rejects.toMatchObject({
      status: 401,
      message: "Your temporary password has expired. Contact an administrator.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
