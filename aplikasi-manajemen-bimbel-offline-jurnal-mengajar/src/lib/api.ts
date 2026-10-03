import "server-only";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import type { Permissions } from "@/lib/permissions";

export type ApiErrorDetail = { field: string; message: string };

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    // Dipakai untuk error per-field, sama bentuknya dengan error validasi Zod.
    public details?: ApiErrorDetail[],
  ) {
    super(message);
  }
}

type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

// Custom cookie-authenticated mutations must come from the app's own origin.
// Better Auth protects its own endpoints; ours need the same check.
export function assertSameOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  if (
    request.headers.get("origin") !== new URL(env.BETTER_AUTH_URL).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new ApiError(
      403,
      "FORBIDDEN_ORIGIN",
      "Send this request from the app's configured origin.",
    );
}

// Every app endpoint answers through this wrapper so error shapes and caching
// stay identical whether or not the endpoint needs a session.
export async function withApiError(handler: () => Promise<Response>) {
  let response: Response;
  try {
    response = await handler();
  } catch (error) {
    if (error instanceof ApiError) {
      response = Response.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        { status: error.status },
      );
    } else if (error instanceof ZodError) {
      response = Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Check the supplied fields.",
            details: error.issues.map((issue) => ({
              field: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
        { status: 422 },
      );
    } else {
      // Do not return database errors, connection strings, or private values to clients.
      console.error(
        "Unexpected API failure:",
        error instanceof Error ? error.name : "UnknownError",
      );
      response = Response.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Something went wrong. Try again.",
          },
        },
        { status: 500 },
      );
    }
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

// Shared HTTP concerns only. Domain rules and Drizzle queries live in services.
export async function withApiSession(
  request: Request,
  handler: (session: Session) => Promise<Response>,
) {
  return withApiError(async () => {
    const session = await auth.api.getSession({
      headers: request.headers,
      query: { disableCookieCache: true },
    });
    // Akun yang dinonaktifkan kehilangan sesinya seketika, sama seperti halaman.
    if (!session || session.user.banned)
      throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");

    assertSameOrigin(request);
    return handler(session);
  });
}

// Same contract as withApiSession, plus a role check before the handler runs.
// Endpoints that reach across accounts must use this, not a UI-only check.
export function withApiPermission(
  request: Request,
  permissions: Permissions,
  handler: (session: Session) => Promise<Response>,
) {
  return withApiSession(request, async (session) => {
    const { success } = await auth.api.userHasPermission({
      body: { userId: session.user.id, permissions },
    });
    if (!success)
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Your account cannot perform this action.",
      );
    return handler(session);
  });
}

/**
 * Meneruskan satu permintaan ke penangan Better Auth, supaya endpoint aplikasi
 * ikut memakai jalur yang sama: pemeriksaan origin, batas laju, peran bawaan,
 * dan pembuatan sesi. Alamatnya diambil dari BETTER_AUTH_URL, bukan dari alamat
 * permintaan, karena aplikasi bisa diakses lewat proksi atau port lain.
 */
export function callAuthHandler(path: string, request: Request, body: unknown) {
  return auth.handler(
    new Request(new URL(path, env.BETTER_AUTH_URL), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: request.headers.get("origin") ?? "",
      },
      body: JSON.stringify(body),
    }),
  );
}

export async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json")
    throw new ApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Send an application/json body.",
    );
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Send valid JSON.");
  }
}
