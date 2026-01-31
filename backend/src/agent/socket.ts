import { Request, Response } from "express";
import logger from "../logger";
import { settings } from "../config/settings";
import { workos, WORKOS_SESSION_COOKIE_NAME } from "../routes/auth";

export async function requestSessionSocketToken(req: Request, res: Response) {
  try {
    const sealedSessionData = req.cookies[WORKOS_SESSION_COOKIE_NAME];
    if (!sealedSessionData) {
      return res.status(401).json({ error: "No session" });
    }

    const session = workos.userManagement.loadSealedSession({
      sessionData: sealedSessionData,
      cookiePassword: settings.workos.cookiePassword,
    });

    const authResult = await session.authenticate();
    if (!authResult.authenticated) {
      return res.status(401).json({ error: "Invalid session" });
    }

    res.json({ token: authResult.accessToken });
  } catch (error) {
    logger.error("Failed to request session socket token", { error });
    res.status(500).json({ error: "Failed to request session socket token" });
  }
}
