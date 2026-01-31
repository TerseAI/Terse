import { Request, Response } from "express";
import { settings } from "../config/settings";
import logger from "../logger";
import { workos, WORKOS_SESSION_COOKIE_NAME } from "./auth";

export async function createOrganization(req: Request, res: Response) {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const name = req.body?.name as string | undefined;
  if (!name || typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({ error: "Organization name is required" });
  }

  try {
    const organization = await workos.organizations.createOrganization({
      name: name.trim(),
    });

    await workos.userManagement.createOrganizationMembership({
      organizationId: organization.id,
      userId: user.workosId,
      roleSlug: "admin",
    });

    const sealedSessionData = req.cookies[WORKOS_SESSION_COOKIE_NAME];
    if (!sealedSessionData) {
      logger.error("Failed to create organization: no session cookie", {
        organizationId: organization.id,
        userId: user.id,
      });
      return res.status(500).json({
        error: "Session expired. Please log in again and try creating the organization.",
      });
    }

    const session = workos.userManagement.loadSealedSession({
      sessionData: sealedSessionData,
      cookiePassword: settings.workos.cookiePassword,
    });
    const refreshResult = await session.refresh({
      organizationId: organization.id,
      cookiePassword: settings.workos.cookiePassword,
    });

    if (!refreshResult.authenticated || !refreshResult.sealedSession) {
      logger.error("Failed to create organization: session refresh failed", {
        organizationId: organization.id,
        userId: user.id,
      });
      return res.status(500).json({
        error: "Organization was created but we could not update your session. Please log out and log back in to use it.",
      });
    }

    res.cookie(WORKOS_SESSION_COOKIE_NAME, refreshResult.sealedSession, {
      path: "/",
      httpOnly: true,
      secure: settings.nodeEnv === "production",
      sameSite: "lax",
    });

    logger.info("Organization created", {
      organizationId: organization.id,
      userId: user.id,
      name: organization.name,
    });

    return res.status(201).json({
      id: organization.id,
      name: organization.name,
    });
  } catch (error) {
    logger.error("Failed to create organization", {
      error,
      userId: user.id,
      name: name.trim(),
    });
    return res.status(500).json({
      error: "Failed to create organization. Please try again.",
    });
  }
}

export async function getCurrentOrganization(req: Request, res: Response) {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!user.organizationId) {
    return res.status(404).json({
      error: "User has no organization",
      code: "ORGANIZATION_REQUIRED",
      redirectTo: "/organization/create",
    });
  }

  try {
    const organization = await workos.organizations.getOrganization(
      user.organizationId,
    );
    return res.json({
      id: organization.id,
      name: organization.name,
    });
  } catch (error) {
    logger.error("Failed to get organization from WorkOS", {
      error,
      organizationId: user.organizationId,
    });
    return res.status(500).json({
      error: "Failed to load organization.",
    });
  }
}

export async function getUserOrganizations(req: Request, res: Response) {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!user.workosId) {
    return res.status(400).json({
      error: "User has no WorkOS ID. Re-authenticate to link account.",
    });
  }

  try {
    const memberships = await workos.userManagement.listOrganizationMemberships(
      {
        userId: user.workosId,
      },
    );
    const orgIds = [
      ...new Set(
        (memberships.data ?? []).map((m) => m.organizationId),
      ),
    ];
    const organizations = await Promise.all(
      orgIds.map(async (id) => {
        const org = await workos.organizations.getOrganization(id);
        return { id: org.id, name: org.name };
      }),
    );
    return res.json({ organizations });
  } catch (error) {
    logger.error("Failed to list user organizations", {
      error,
      userId: user.id,
    });
    return res.status(500).json({
      error: "Failed to load organizations.",
    });
  }
}

export async function switchOrganization(req: Request, res: Response) {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const organizationId = req.body?.organizationId as string | undefined;
  if (!organizationId || typeof organizationId !== "string") {
    return res.status(400).json({ error: "organizationId is required" });
  }

  const sealedSessionData = req.cookies[WORKOS_SESSION_COOKIE_NAME];
  if (!sealedSessionData) {
    return res.status(401).json({ error: "No session" });
  }

  try {
    const session = workos.userManagement.loadSealedSession({
      sessionData: sealedSessionData,
      cookiePassword: settings.workos.cookiePassword,
    });
    const refreshResult = await session.refresh({
      organizationId,
      cookiePassword: settings.workos.cookiePassword,
    });

    if (!refreshResult.authenticated || !refreshResult.sealedSession) {
      return res.status(403).json({
        error: "Not authorized for this organization",
        redirectUrl: settings.urls.frontend,
      });
    }

    res.cookie(WORKOS_SESSION_COOKIE_NAME, refreshResult.sealedSession, {
      path: "/",
      httpOnly: true,
      secure: settings.nodeEnv === "production",
      sameSite: "lax",
    });

    return res.json({ success: true });
  } catch (error) {
    logger.error("Failed to switch organization", {
      error,
      userId: user.id,
      organizationId,
    });
    return res.status(500).json({
      error: "Failed to switch organization.",
      redirectUrl: settings.urls.frontend,
    });
  }
}
