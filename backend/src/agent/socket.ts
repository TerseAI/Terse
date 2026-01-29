import { Request, Response } from "express";
import logger from "../logger";
import { Jwt } from "../utility/jwt";

export async function requestSessionSocketToken(req: Request, res: Response) {
  try {
    let user = req.session?.user;
    const token = await new Jwt().sign(user.id);
    res.json(token);
  } catch (error) {
    logger.error("Failed to request session socket token", { error });
    res.status(500).json({ error: "Failed to request session socket token" });
  }
}
