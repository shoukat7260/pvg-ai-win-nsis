import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiClientError,
  createApiClient,
  createRequestId,
  parseApiError,
} from "./index.js";

const TS = "2026-09-29T06:00:00.000Z";

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

describe("createRequestId", () => {
  it("returns a non-empty string", () => {
    expect(createRequestId().length).toBeGreaterThan(8);
  });
});

describe("parseApiError", () => {
  it("parses structured ApiError bodies", async () => {
    const res = jsonResponse(
      {
        code: "not_found",
        message: "Missing",
        request_id: "abc",
      },
      { status: 404, headers: { "x-request-id": "hdr" } },
    );
    const err = await parseApiError(res, "fallback");
    expect(err.code).toBe("not_found");
    expect(err.request_id).toBe("abc");
    expect(err.status).toBe(404);
  });

  it("surfaces password validation details clearly", async () => {
    const res = jsonResponse(
      {
        error: {
          code: "validation_error",
          message: "Request validation failed",
          request_id: "req-1",
          details: {
            errors: [
              {
                type: "string_too_short",
                loc: ["body", "password"],
                msg: "String should have at least 10 characters",
                ctx: { min_length: 10 },
              },
            ],
          },
        },
      },
      { status: 422 },
    );
    const err = await parseApiError(res, "fallback");
    expect(err.message).toBe("Password must be at least 10 characters");
  });

  it("uses header request id when body lacks it", async () => {
    const res = jsonResponse(
      { code: "x", message: "y" },
      { status: 400, headers: { "x-request-id": "from-header" } },
    );
    const err = await parseApiError(res, "fallback");
    expect(err.request_id).toBe("from-header");
  });
});

describe("PvgApiClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls /api/v1/me with X-Request-Id and Authorization", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        email: "a@example.com",
        displayName: "Ada",
        status: "active",
        createdAt: TS,
        updatedAt: TS,
      }),
    );

    const client = createApiClient({
      baseUrl: "http://localhost:8000",
      fetch: fetchMock as unknown as typeof fetch,
      getAccessToken: () => "tok",
    });

    const me = await client.getMe({ requestId: "req-fixed" });
    expect(me.email).toBe("a@example.com");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/api/v1/me");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Request-Id"]).toBe("req-fixed");
    expect(headers.Authorization).toBe("Bearer tok");
  });

  it("lists workspaces and projects", async () => {
    const workspace = {
      id: "550e8400-e29b-41d4-a716-446655440001",
      name: "Main",
      slug: "main",
      ownerId: "550e8400-e29b-41d4-a716-446655440000",
      createdAt: TS,
      updatedAt: TS,
    };
    const project = {
      id: "550e8400-e29b-41d4-a716-446655440002",
      workspaceId: workspace.id,
      name: "Promo",
      description: null,
      status: "draft",
      schemaVersion: 1,
      createdAt: TS,
      updatedAt: TS,
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([workspace]))
      .mockResolvedValueOnce(jsonResponse(workspace))
      .mockResolvedValueOnce(jsonResponse([project]))
      .mockResolvedValueOnce(jsonResponse(project));

    const client = createApiClient({
      baseUrl: "http://localhost:8000/",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(client.listWorkspaces()).resolves.toHaveLength(1);
    await expect(client.getWorkspace(workspace.id)).resolves.toMatchObject({
      slug: "main",
    });
    await expect(client.listProjects(workspace.id)).resolves.toHaveLength(1);
    await expect(
      client.getProject(workspace.id, project.id),
    ).resolves.toMatchObject({ name: "Promo" });

    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls).toEqual([
      "http://localhost:8000/api/v1/workspaces",
      `http://localhost:8000/api/v1/workspaces/${workspace.id}`,
      `http://localhost:8000/api/v1/workspaces/${workspace.id}/projects`,
      `http://localhost:8000/api/v1/workspaces/${workspace.id}/projects/${project.id}`,
    ]);
  });

  it("health and ready", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "ok", version: "0.1.0" }))
      .mockResolvedValueOnce(
        jsonResponse({
          status: "ready",
          checks: { db: { ok: true } },
        }),
      );

    const client = createApiClient({
      baseUrl: "http://localhost:8000",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(client.health()).resolves.toEqual({
      status: "ok",
      version: "0.1.0",
    });
    await expect(client.ready()).resolves.toMatchObject({ status: "ready" });
  });

  it("throws ApiClientError with parsed body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          code: "unauthorized",
          message: "Login required",
          request_id: "r1",
        },
        { status: 401 },
      ),
    );

    const client = createApiClient({
      baseUrl: "http://localhost:8000",
      fetch: fetchMock as unknown as typeof fetch,
    });

    try {
      await client.getMe();
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiClientError);
      const e = err as ApiClientError;
      expect(e.status).toBe(401);
      expect(e.apiError.code).toBe("unauthorized");
      expect(e.apiError.request_id).toBe("r1");
    }
  });
});
