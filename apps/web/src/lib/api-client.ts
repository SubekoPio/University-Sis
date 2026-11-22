// Purpose: Provide typed browser requests for the API and refreshable auth sessions.
// Used by: Authentication forms and future protected web-app data hooks.

/** Public account information returned by authentication endpoints. */
export interface AuthUser {
  id: string;
  email: string;
  status: "ACTIVE" | "SUSPENDED" | "DISABLED";
  emailVerified: boolean;
  mustChangePassword?: boolean;
  roles?: readonly string[];
  permissions?: readonly string[];
}

/** Access and refresh token pair returned by login and refresh endpoints. */
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: AuthUser;
}

/** Message response returned by recovery and verification endpoints. */
export interface MessageResponse {
  message: string;
}

/** Normalized error surfaced by the API client for non-success responses. */
export class ApiError extends Error {
  /** HTTP status code returned by the API. */
  readonly status: number;

  /** Stable API error code, when the response includes one. */
  readonly code: string | null;

  /**
   * Creates a normalized API error.
   *
   * @param message - User-safe message returned by the API or fallback.
   * @param status - HTTP response status.
   * @param code - Stable API error code, if supplied.
   */
  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type AuthSession = AuthResult;

interface ApiErrorPayload {
  message: string;
  code?: string;
}

const SESSION_STORAGE_KEY = "university-sis.auth-session";
const PASSWORD_CHANGE_NOTICE_KEY = "university-sis.password-change-notice";
const MUST_CHANGE_PASSWORD_CODE = "MUST_CHANGE_PASSWORD";
const AUTH_STATE_CHANGE_EVENT = "university-sis:auth-state-change";
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001").replace(
  /\/+$/,
  "",
);

let refreshInFlight: Promise<string | null> | null = null;
let cachedAuthUserStorageValue: string | null | undefined;
let cachedAuthUser: AuthUser | null = null;

/**
 * Sends an API request, attaching the current access token and retrying once
 * after a successful refresh when a protected request returns 401.
 *
 * @param path - API path beginning with `/`.
 * @param init - Standard fetch request options.
 * @returns Parsed JSON response.
 * @throws ApiError when the API responds with a non-success status.
 */
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return requestJson<T>(path, init, true);
}

/**
 * Authenticates a user and stores the returned token pair for this browser tab.
 *
 * @param credentials - Email and password submitted by the login form.
 * @returns Authentication tokens and the safe user summary.
 */
export async function login(credentials: { email: string; password: string }): Promise<AuthResult> {
  const result = await postJson<unknown>("/auth/login", credentials, false);
  if (!isAuthResult(result)) {
    throw new ApiError("The API returned an invalid login response.", 502, null);
  }

  clearPasswordChangeNotice();
  saveAuthSession(result);
  if (result.user.mustChangePassword !== undefined) {
    return result;
  }

  // The current API omits this flag, so refresh probes the enforced gate without a protected feature endpoint.
  try {
    const refreshedAccessToken = await performRefresh();
    const refreshedSession = readAuthSession();
    if (refreshedAccessToken === null || refreshedSession === null) {
      throw new ApiError("Your sign-in session could not be confirmed.", 401, null);
    }

    return refreshedSession;
  } catch (error: unknown) {
    if (!(error instanceof ApiError && error.code === MUST_CHANGE_PASSWORD_CODE)) {
      clearAuthSession();
    }
    throw error;
  }
}

/**
 * Changes the signed-in user's temporary password.
 *
 * @param input - The current temporary password and its replacement.
 * @returns API confirmation message.
 */
export async function changeTemporaryPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<MessageResponse> {
  const response = await postJson<MessageResponse>("/auth/change-password", input, false);
  const session = readAuthSession();
  if (session !== null) {
    saveAuthSession({
      ...session,
      user: { ...session.user, mustChangePassword: false },
    });
  }
  clearPasswordChangeNotice();

  return response;
}

/**
 * Requests password-reset instructions without exposing account existence.
 *
 * @param email - Account email address.
 * @returns Generic API response message.
 */
export function forgotPassword(email: string): Promise<MessageResponse> {
  return postJson("/auth/forgot-password", { email }, false);
}

/**
 * Submits a one-time reset token and replacement password.
 *
 * @param input - Reset token and new password.
 * @returns API confirmation message.
 */
export function resetPassword(input: {
  token: string;
  password: string;
}): Promise<MessageResponse> {
  return postJson("/auth/reset-password", input, false);
}

/**
 * Verifies an email address using its one-time token.
 *
 * @param token - Verification token delivered by email.
 * @returns API confirmation message.
 */
export function verifyEmail(token: string): Promise<MessageResponse> {
  return postJson("/auth/verify-email", { token }, false);
}

/**
 * Revokes the current refresh session and clears browser-held auth tokens.
 *
 * @returns Resolves after the logout request and local cleanup.
 */
export async function logout(): Promise<void> {
  const session = readAuthSession();
  if (session === null) {
    clearAuthSession();
    return;
  }

  try {
    await postJson<{ success: true }>(
      "/auth/logout",
      { refreshToken: session.refreshToken },
      false,
    );
  } finally {
    clearAuthSession();
    clearPasswordChangeNotice();
  }
}

/**
 * Returns a safe message for form-level API errors.
 *
 * @param error - Error thrown by a query or mutation.
 * @param fallback - Message used for unexpected errors.
 * @returns A display-safe error string.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Reads the safe identity from the current browser session.
 *
 * @returns The signed-in user's public details, or null when no session exists.
 */
export function getCurrentAuthUser(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (storedValue === cachedAuthUserStorageValue) {
    return cachedAuthUser;
  }
  const session = readAuthSession();
  cachedAuthUserStorageValue = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  cachedAuthUser = session?.user ?? null;
  return cachedAuthUser;
}

/**
 * Returns the browser-held authentication session, including tokens.
 *
 * @returns The current auth session or null outside an active session.
 */
export function getAuthSession(): AuthResult | null {
  return readAuthSession();
}

/**
 * Updates the current user summary with authorization metadata resolved by the
 * frontend shell.
 *
 * @param authorization - Roles and permissions available to the current user.
 * @returns The updated public user summary or null when no session exists.
 */
export function updateAuthAuthorization(authorization: {
  roles?: readonly string[];
  permissions?: readonly string[];
}): AuthUser | null {
  const session = readAuthSession();
  if (session === null) {
    return null;
  }

  const updatedSession: AuthResult = {
    ...session,
    user: {
      ...session.user,
      roles: authorization.roles,
      permissions: authorization.permissions,
    },
  };
  saveAuthSession(updatedSession);
  return updatedSession.user;
}

/**
 * Subscribes to same-tab and cross-tab authentication changes.
 *
 * @param onChange - Called when the browser session or password-change notice changes.
 * @returns A cleanup function for the event listeners.
 */
export function subscribeToAuthState(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(AUTH_STATE_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(AUTH_STATE_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Reads a saved notice explaining why a password change is required.
 *
 * @returns The API notice, or null when no notice was recorded.
 */
export function getPasswordChangeNotice(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(PASSWORD_CHANGE_NOTICE_KEY);
}

/**
 * Clears a previously displayed forced-password-change notice.
 */
export function clearPasswordChangeNotice(): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(PASSWORD_CHANGE_NOTICE_KEY);
    notifyAuthStateChanged();
  }
}

async function postJson<T>(path: string, body: unknown, retryOnUnauthorized: boolean): Promise<T> {
  return requestJson<T>(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    retryOnUnauthorized,
  );
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  retryOnUnauthorized: boolean,
): Promise<T> {
  const sessionAtRequest = readAuthSession();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (sessionAtRequest !== null) {
    headers.set("Authorization", `Bearer ${sessionAtRequest.accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${normalizePath(path)}`, {
    ...init,
    headers,
  });

  if (response.status === 401 && retryOnUnauthorized && normalizePath(path) !== "/auth/refresh") {
    const latestSession = readAuthSession();
    const newerAccessToken =
      latestSession !== null && latestSession.accessToken !== sessionAtRequest?.accessToken
        ? latestSession.accessToken
        : await refreshAccessToken();

    if (newerAccessToken !== null) {
      return requestJson<T>(path, init, false);
    }

    clearAuthSession();
  }

  if (!response.ok) {
    const error = await createApiError(response);
    redirectForPasswordChange(error, path);
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight !== null) {
    return refreshInFlight;
  }

  refreshInFlight = performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function performRefresh(): Promise<string | null> {
  const session = readAuthSession();
  if (session === null) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });

  if (response.status === 401) {
    clearAuthSession();
    return null;
  }
  if (!response.ok) {
    const error = await createApiError(response);
    redirectForPasswordChange(error, "/auth/refresh");
    throw error;
  }

  const result: unknown = await response.json();
  if (!isAuthResult(result)) {
    clearAuthSession();
    throw new ApiError("The API returned an invalid refresh response.", 502, null);
  }

  saveAuthSession(result);
  return result.accessToken;
}

async function createApiError(response: Response): Promise<ApiError> {
  const responseText = await response.text();
  const payload = parseErrorPayload(responseText);
  return new ApiError(
    payload?.message ?? `Request failed with status ${response.status}.`,
    response.status,
    payload?.code ?? null,
  );
}

function parseErrorPayload(responseText: string): ApiErrorPayload | null {
  if (responseText.length === 0) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(responseText);
    if (
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
    ) {
      const code = "code" in payload && typeof payload.code === "string" ? payload.code : undefined;
      return { message: payload.message, code };
    }
    return null;
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
}

function readAuthSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (storedValue === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(storedValue);
    if (isAuthResult(parsed)) {
      return parsed;
    }
    clearAuthSession();
    return null;
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      clearAuthSession();
      return null;
    }
    throw error;
  }
}

function saveAuthSession(session: AuthSession): void {
  if (typeof window === "undefined") {
    throw new Error("Authentication sessions can only be saved in a browser.");
  }

  const serializedSession = JSON.stringify(session);
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, serializedSession);
  cachedAuthUserStorageValue = serializedSession;
  cachedAuthUser = session.user;
  notifyAuthStateChanged();
}

function clearAuthSession(): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    cachedAuthUserStorageValue = null;
    cachedAuthUser = null;
    notifyAuthStateChanged();
  }
}

function redirectForPasswordChange(error: ApiError, requestPath: string): void {
  if (
    error.code !== MUST_CHANGE_PASSWORD_CODE ||
    typeof window === "undefined" ||
    normalizePath(requestPath).replace(/\/+$/, "") === "/auth/change-password"
  ) {
    return;
  }

  const session = readAuthSession();
  if (session !== null) {
    saveAuthSession({
      ...session,
      user: { ...session.user, mustChangePassword: true },
    });
  }
  window.sessionStorage.setItem(PASSWORD_CHANGE_NOTICE_KEY, error.message);
  notifyAuthStateChanged();
}

function notifyAuthStateChanged(): void {
  window.dispatchEvent(new Event(AUTH_STATE_CHANGE_EVENT));
}

function isAuthResult(value: unknown): value is AuthResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "accessToken" in value &&
    typeof value.accessToken === "string" &&
    "refreshToken" in value &&
    typeof value.refreshToken === "string" &&
    "tokenType" in value &&
    value.tokenType === "Bearer" &&
    "expiresIn" in value &&
    typeof value.expiresIn === "number" &&
    "user" in value &&
    isAuthUser(value.user)
  );
}

function isAuthUser(value: unknown): value is AuthUser {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "email" in value &&
    typeof value.email === "string" &&
    "status" in value &&
    (value.status === "ACTIVE" || value.status === "SUSPENDED" || value.status === "DISABLED") &&
    "emailVerified" in value &&
    typeof value.emailVerified === "boolean" &&
    (!("mustChangePassword" in value) || typeof value.mustChangePassword === "boolean") &&
    (!("roles" in value) ||
      (Array.isArray(value.roles) &&
        value.roles.every((role): role is string => typeof role === "string"))) &&
    (!("permissions" in value) ||
      (Array.isArray(value.permissions) &&
        value.permissions.every(
          (permission): permission is string => typeof permission === "string",
        )))
  );
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}
