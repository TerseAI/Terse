import { users as PrismaUser } from "@prisma/client";
import {
  AuthenticateWithSessionCookieSuccessResponse,
  AuthenticationResponse,
  WorkOS,
} from "@workos-inc/node";
import { NextFunction, Request, Response } from "express";
import { settings } from "../config/settings";
import logger from "../logger";
import { db } from "../prismaClient";
import { Session } from "../server";
import { Role, User } from "../shared/types";

export const WORKOS_SESSION_COOKIE_NAME = "TERSE_WORKOS_SESSION";

export const workos = new WorkOS({
  apiKey: settings.workos.apiKey,
  clientId: settings.workos.clientId,
});

export async function login(req: Request, res: Response) {
  const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    provider: "authkit",
    redirectUri: settings.workos.redirectUri,
  });
  res.redirect(authorizationUrl);
}

export async function logout(req: Request, res: Response) {
  const session = workos.userManagement.loadSealedSession({
    sessionData: req.cookies[WORKOS_SESSION_COOKIE_NAME],
    cookiePassword: settings.workos.cookiePassword,
  });
  const url = await session.getLogoutUrl({ returnTo: settings.urls.backend });
  res.clearCookie(WORKOS_SESSION_COOKIE_NAME);
  res.redirect(url);
}

export async function me(req: Request, res: Response) {
  const user = req.session?.user || null;
  if (!user) {
    return res.status(401).send("Unauthorized");
  }
  // Always fetch fresh profile data from WorkOS so profile updates (e.g., from User Profile widget)
  // are reflected immediately when the frontend calls refreshUser()
  try {
    const workOSUser = await workos.userManagement.getUser(user.workosId);
    const refreshedUser: User = {
      ...user,
      email: workOSUser.email,
      displayName: workOSUser.firstName + " " + workOSUser.lastName,
      displayPhotoUrl: workOSUser.profilePictureUrl || "",
    };
    return res.send(refreshedUser);
  } catch (error) {
    logger.warn("Failed to fetch fresh user from WorkOS, returning session user", {
      error,
      userId: user.id,
    });
    return res.send(user);
  }
}

function createAuthMiddleware(requireOrganization: boolean) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = workos.userManagement.loadSealedSession({
        sessionData: req.cookies[WORKOS_SESSION_COOKIE_NAME],
        cookiePassword: settings.workos.cookiePassword,
      });
      const authResult = await session.authenticate();

      if (authResult.authenticated) {
        const user = await getOrCreateDbUserFromWorkOS(authResult);
        if (!req.session) {
          req.session = {
            user: user,
          } as Session;
        } else {
          req.session.user = user;
        }
        if (requireOrganization && !user.organizationId) {
          return sendOrganizationRequired(req, res);
        }
        return next();
      }

      // Give up if no cookie is provided
      const authenticated = authResult.authenticated;
      const authFailedReason = authResult.reason;
      if (!authenticated && authFailedReason === "no_session_cookie_provided") {
        return sendUnauthorized(req, res);
      }

      // try refreshing the session, it may have gone stale
      const refreshedSessionResult = await session.refresh();
      if (!refreshedSessionResult.authenticated) {
        return sendUnauthorized(req, res);
      }
      const user = await getOrCreateDbUserFromWorkOS(refreshedSessionResult);
      if (!req.session) {
        req.session = {
          user: user,
        } as Session;
      } else {
        req.session.user = user;
      }

      const sealedSession = refreshedSessionResult.sealedSession;

      if (requireOrganization && !user.organizationId) {
        return sendOrganizationRequired(req, res);
      }

      // update the cookie
      res.cookie(WORKOS_SESSION_COOKIE_NAME, sealedSession, {
        path: "/",
        httpOnly: true,
        secure: settings.nodeEnv === "production",
        sameSite: "lax",
      });
      return next();
    } catch (error) {
      logger.error("Failed to authorize user", {
        error,
      });
      res.clearCookie(WORKOS_SESSION_COOKIE_NAME);
      return sendUnauthorized(req, res);
    }
  };
}

function isApiRequest(req: Request): boolean {
  const acceptHeader = req.get("accept") || "";
  return acceptHeader.includes("application/json");
}

function sendUnauthorized(req: Request, res: Response) {
  if (isApiRequest(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return res.redirect("/login");
}

function sendOrganizationRequired(req: Request, res: Response) {
  return res.status(403).json({
    code: "ORGANIZATION_REQUIRED",
    message: "User must create or join an organization",
    redirectTo: "/organization/create",
  });
}

export async function callback(req: Request, res: Response) {
  const code = req.query.code as string;

  if (!code) {
    return res.status(400).send("No code provided");
  }

  try {
    const authenticateResponse =
      await workos.userManagement.authenticateWithCode({
        clientId: settings.workos.clientId,
        code,
        session: {
          sealSession: true,
          cookiePassword: settings.workos.cookiePassword,
        },
      });
    if (!authenticateResponse.sealedSession) {
      return res.status(401).send("No sealed session provided");
    }
    const workosSession = workos.userManagement.loadSealedSession({
      sessionData: authenticateResponse.sealedSession,
      cookiePassword: settings.workos.cookiePassword,
    });
    const authResult = await workosSession.authenticate();
    if (!authResult.authenticated) {
      return res.status(401).send("Failed to authenticate");
    }

    // Create user record in database if it doesn't already
    // exist
    await getOrCreateDbUserFromWorkOS(authResult);

    // Store the session in a cookie
    res.cookie(WORKOS_SESSION_COOKIE_NAME, authenticateResponse.sealedSession, {
      path: "/",
      httpOnly: true,
      secure: settings.nodeEnv === "production",
      sameSite: "lax",
    });

    // Redirect the user to the homepage
    return res.redirect(settings.urls.frontend);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("WorkOS callback error", { error, message: errorMessage });
    // Don't redirect to /login here as it causes an infinite redirect loop
    // Clear any stale session cookie and show an error
    res.clearCookie(WORKOS_SESSION_COOKIE_NAME);
    return res
      .status(500)
      .send(
        `Authentication failed: ${errorMessage}. ` +
          `Please <a href="${settings.urls.frontend}">return to the app</a> and try again. ` +
          `If the problem persists, clear your cookies for this site.`,
      );
  }
}

export async function getWorkOSWidgetToken(req: Request, res: Response) {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!user.organizationId) {
    return res.status(400).json({
      error: "User has no organization. Create an organization first.",
    });
  }
  const workosUserId = user?.workosId;
  if (!workosUserId) {
    return res.status(400).json({
      error: "User has no WorkOS ID. Re-authenticate to link account.",
    });
  }

  const widgetToken = await workos.widgets.getToken({
    organizationId: user.organizationId,
    userId: workosUserId,
  });

  return res.json({ token: widgetToken });
}

export async function getOrCreateDbUserFromWorkOS(
  authResult:
    | AuthenticateWithSessionCookieSuccessResponse
    | RefreshSessionSuccessResponse,
): Promise<User> {
  const prisma = db();
  const workosUser = authResult.user;
  let dbUser: PrismaUser | null = await prisma.users.findUnique({
    where: {
      workos_id: workosUser.id,
    },
  });
  if (!dbUser) {
    dbUser = await prisma.users.create({
      data: {
        workos_id: workosUser.id,
      },
    });
  }

  const roles = authResult.roles || [];

  let organizationName = undefined;
  if (authResult.organizationId) {
    const organization = await workos.organizations.getOrganization(
      authResult.organizationId,
    );
    organizationName = organization.name;
  }

  return {
    id: dbUser.id,
    workosId: workosUser.id,
    organizationId: authResult.organizationId ?? "",
    organizationName: organizationName ?? "",
    email: workosUser.email,
    displayName: workosUser.firstName + " " + workosUser.lastName,
    displayPhotoUrl: workosUser.profilePictureUrl || "",
    roles: roles as Role[],
  };
}

export async function getUserForOrg(
  userId: string,
  organizationId: string,
): Promise<User | null> {
  const prisma = db();
  const dbUser = await prisma.users.findUnique({
    where: { id: userId },
  });

  if (!dbUser) {
    return null;
  }

  const workOSId = dbUser.workos_id;
  const workOSUser = await workos.userManagement.getUser(workOSId);
  if (!workOSUser) {
    return null;
  }

  const organization = await workos.organizations.getOrganization(
    organizationId,
  );
  const organizationName = organization.name;

  const organizationMemberships =
    await workos.userManagement.listOrganizationMemberships({
      userId: workOSId,
      organizationId: organizationId,
      statuses: ["active"],
    });
  if (!organizationMemberships.data) {
    return null;
  }

  let roles: Role[] = [];
  organizationMemberships.data.forEach((membership) => {
    if (membership.organizationId === organizationId) {
      roles = (membership.roles?.map((role) => role.slug) as Role[]) || [];
    }
  });

  return {
    id: dbUser.id,
    workosId: workOSId,
    organizationId: organizationId,
    organizationName: organizationName,
    email: workOSUser.email,
    displayName: workOSUser.firstName + " " + workOSUser.lastName,
    displayPhotoUrl: workOSUser.profilePictureUrl || "",
    roles: roles,
  };
}

// Library doesn't export this type properly, so we need to define it ourselves
type RefreshSessionSuccessResponse = Omit<
  AuthenticateWithSessionCookieSuccessResponse,
  "accessToken"
> & {
  authenticated: true;
  session?: AuthenticationResponse;
  sealedSession?: string;
};

// By default, every user must be in an organization for most routes
export const authMiddleware = createAuthMiddleware(true);

// Some routes have an exception to this rule
export const authMiddlewareAllowNoOrg = createAuthMiddleware(false);

export default { me, login, logout, getWorkOSWidgetToken, callback };
