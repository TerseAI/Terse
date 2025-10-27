import { Request, Response } from "express";
import { db } from "../prismaClient";
import chalk from "chalk";
import { NotionIntegration } from "../shared/types";

export const setNotionIntegration = async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { integrationToken, databaseId }: NotionIntegration = req.body;
  console.log(chalk.blue("🔑 Adding Notion integration for user"), chalk.yellow(user.id));

  if (!integrationToken || !databaseId) {
    return res.status(400).json({ error: "Integration token and database ID are required" });
  }

  try {
    // Check if integration already exists
    const existingIntegration = await db().notion_integrations.findUnique({
      where: {
        user_id: user.id,
      },
    });

    if (existingIntegration) {
      // Update existing integration
      await db().notion_integrations.update({
        where: {
          user_id: user.id,
        },
        data: {
          integration_token: integrationToken,
          database_id: databaseId,
        },
      });
      console.log(chalk.green("✅ Updated Notion integration for user"), chalk.yellow(user.id));
    } else {
      // Create new integration
      await db().notion_integrations.create({
        data: {
          user_id: user.id,
          integration_token: integrationToken,
          database_id: databaseId,
        },
      });
      console.log(chalk.green("✅ Created Notion integration for user"), chalk.yellow(user.id));
    }

    res.status(200).json({ message: "Notion integration set" });
  } catch (error) {
    console.error(chalk.red("Error setting Notion integration:"), error);
    res.status(500).json({ error: "Failed to set Notion integration" });
  }
};

export const getNotionIntegration = async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const integration = await db().notion_integrations.findUnique({
      where: {
        user_id: user.id,
      },
    });

    if (!integration) {
      console.log("No Notion integration found for user", user.id);
      return res.status(200).json({
        integrationToken: null,
        databaseId: null,
      });
    }

    const response: NotionIntegration = {
      integrationToken: integration.integration_token,
      databaseId: integration.database_id,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error(chalk.red("Error getting Notion integration:"), error);
    res.status(500).json({ error: "Failed to get Notion integration" });
  }
};

export const deleteNotionIntegration = async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const integration = await db().notion_integrations.findUnique({
      where: {
        user_id: user.id,
      },
    });

    if (!integration) {
      return res.status(404).json({ error: "No Notion integration found" });
    }

    // Clean up automation inputs/outputs that reference this Notion integration
    await db().automation_inputs.deleteMany({
      where: {
        integration_type: "NOTION",
        integration_id: integration.id,
      },
    });

    await db().automation_outputs.deleteMany({
      where: {
        integration_type: "NOTION",
        integration_id: integration.id,
      },
    });

    await db().notion_integrations.delete({
      where: { user_id: user.id },
    });

    console.log(chalk.green("✅ Deleted Notion integration for user"), chalk.yellow(user.id));
    res.status(200).json({ message: "Notion integration deleted" });
  } catch (error) {
    console.error(chalk.red("Error deleting Notion integration:"), error);
    res.status(500).json({ error: "Failed to delete Notion integration" });
  }
};
