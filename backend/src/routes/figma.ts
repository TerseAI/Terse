import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import chalk from "chalk";
import { db } from "../prismaClient";
import { FigmaCommentEvent, FigmaCommentEventData } from "../Updater/InputEvents";
import { EventProcessor } from "../agent/AutomationAgent/EventProcessor";
import { User } from "../types/prisma";
import { IntegrationType } from "@prisma/client";

// Helper function to get Figma access token for a user
async function getFigmaAccessToken(userId: string): Promise<string> {
  const figmaIntegration = await db().figma_integrations.findFirst({
    where: {
      user_id: userId,
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  if (!figmaIntegration) {
    throw new Error("Figma integration not found");
  }

  if (figmaIntegration.token_expiry && new Date() > figmaIntegration.token_expiry) {
    throw new Error("Figma access token has expired. Please re-authenticate.");
  }

  return figmaIntegration.access_token;
}

export const getFigmaOAuthUrl = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  
    try {
      // Generate state token for security (prevents CSRF)
      const state = jwt.sign(
        { userId: user.id, timestamp: Date.now() },
        process.env.JWT_SECRET!,
        { expiresIn: "10m" }
      );
  
      const clientId = process.env.FIGMA_CLIENT_ID;
      const redirectUrl = process.env.FIGMA_REDIRECT_URL;
      const scope = "current_user:read,file_comments:read,file_content:read,file_metadata:read,file_versions:read,library_assets:read,library_content:read,team_library_content:read,file_dev_resources:read,projects:read,webhooks:read,webhooks:write";
  
      if (!clientId || !redirectUrl) {
        throw new Error("Figma OAuth credentials not configured");
      }
  
      // Build OAuth URL with proper encoding
      const authUrl = new URL("https://www.figma.com/oauth");
      authUrl.searchParams.append("client_id", clientId);
      authUrl.searchParams.append("redirect_uri", redirectUrl);
      authUrl.searchParams.append("scope", scope);
      authUrl.searchParams.append("state", state);
      authUrl.searchParams.append("response_type", "code");
  
      console.log(
        chalk.blue("🔗 Generated Figma OAuth URL for user"),
        chalk.yellow(user.id)
      );
      res.json({ url: authUrl.toString() });
    } catch (error) {
      console.error(chalk.red("Error generating Figma OAuth URL:"), error);
      res.status(500).json({ error: "Failed to generate OAuth URL" });
    }
  };

  export const figmaOAuthCallback = async (req: Request, res: Response) => {
    const { code, state, error } = req.query;

    if (error) {
        console.error(chalk.red("Figma OAuth error:"), error);
        return res.redirect(`${process.env.FRONTEND_URL}/oauth/error`);
    }

    if (!code || !state) {
        return res.status(400).json({ error: "Missing code or state parameter" });
    }
    try {
        // Verify state token to prevent CSRF attacks
        const decoded = jwt.verify(state as string, process.env.JWT_SECRET!) as {
          userId: string;
          timestamp: number;
        };
    
        const clientId = process.env.FIGMA_CLIENT_ID;
        const clientSecret = process.env.FIGMA_CLIENT_SECRET;
        const redirectUri = process.env.FIGMA_REDIRECT_URL;
    
        if (!clientId || !clientSecret || !redirectUri) {
          throw new Error("Figma OAuth credentials not configured");
        }
    
        // Exchange authorization code for access token
        // Figma requires application/x-www-form-urlencoded format
        const params = new URLSearchParams({
          redirect_uri: redirectUri,
          code: code as string,
          grant_type: "authorization_code",
        });
    
        const tokenResponse = await fetch("https://api.figma.com/v1/oauth/token", {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${clientId}:${clientSecret}`
            ).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });
    
        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error(chalk.red("Figma token exchange failed:"), errorText);
          throw new Error(`Figma token exchange failed: ${errorText}`);
        }
    
        const tokenData = await tokenResponse.json();
        const { access_token, refresh_token, expires_in, user_id_string } = tokenData;
    
        console.log(
          chalk.blue("🔑 Received Figma access token for user"),
          chalk.yellow(decoded.userId)
        );
        console.log(
          chalk.blue("👤 Figma User ID:"),
          chalk.yellow(user_id_string)
        );
        console.log(
            chalk.blue("Expires in:"),
            chalk.yellow(expires_in)
        );
        
        // Calculate token expiry
        const tokenExpiry = new Date(Date.now() + (expires_in * 1000));
        
        // Fetch user info from Figma API to get email
        let userEmail: string | null = null;
        try {
          const userInfoResponse = await fetch("https://api.figma.com/v2/me", {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${access_token}`,
            },
          });
          
          if (userInfoResponse.ok) {
            const userInfo = await userInfoResponse.json();
            userEmail = userInfo.email || null;
            console.log(
              chalk.blue("📧 Figma User Email:"),
              chalk.yellow(userEmail || "Not available")
            );
          }
        } catch (error) {
          console.error(chalk.yellow("⚠️  Could not fetch Figma user email (non-critical):"), error);
          // Continue without email - it's not critical
        }
    
        // Check if a connection for this Figma user already exists
        const existing = await db().figma_integrations.findFirst({
          where: {
            user_id: decoded.userId,
            figma_user_id: user_id_string,
          },
        });
    
        if (!existing) {
          await db().figma_integrations.create({
            data: {
              user_id: decoded.userId,
              figma_user_id: user_id_string,
              email: userEmail,
              access_token: access_token,
              refresh_token: refresh_token || null,
              token_expiry: tokenExpiry,
            },
          });
          console.log(
            chalk.green("✅ Created Figma connection for user"),
            chalk.yellow(decoded.userId)
          );
        } else {
          // Update existing connection with new token (in case it was revoked and re-authorized)
          await db().figma_integrations.update({
            where: { id: existing.id },
            data: {
              email: userEmail || existing.email, // Update email if we got it, otherwise keep existing
              access_token: access_token,
              refresh_token: refresh_token || null,
              token_expiry: tokenExpiry,
            },
          });
          console.log(
            chalk.green("✅ Updated Figma connection token for user"),
            chalk.yellow(decoded.userId)
          );
        }
    
        console.log(
          chalk.green("✅ Figma OAuth completed for user"),
          chalk.yellow(decoded.userId)
        );
    
        // Redirect to success page which will auto-close the popup
        res.redirect(`${process.env.FRONTEND_URL}/oauth/success`);
      } catch (error) {
        console.error(chalk.red("Error in Figma OAuth callback:"), error);
        res.redirect(`${process.env.FRONTEND_URL}/oauth/error`);
      }

  };

  export const getFigmaUserInfo = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const accessToken = await getFigmaAccessToken(user.id);

      // Make request to Figma API using OAuth Bearer token
      const response = await fetch("https://api.figma.com/v2/me", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(chalk.red("Figma API error:"), errorText);
        return res.status(response.status).json({ 
          error: "Failed to fetch user info from Figma",
          details: errorText 
        });
      }

      const userInfo = await response.json();

      console.log(
        chalk.blue("📋 Fetched Figma user info for user"),
        chalk.yellow(user.id)
      );

      res.status(200).json(userInfo);
    } catch (error: any) {
      if (error.message === "Figma integration not found") {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes("expired")) {
        return res.status(401).json({ error: error.message });
      }
      console.error(chalk.red("Error fetching Figma user info:"), error);
      res.status(500).json({ error: "Failed to fetch Figma user info" });
    }
  };

  /**
   * Fetch file metadata for a file
   */
  async function fetchFileMetadata(
    accessToken: string,
    fileKey: string
  ): Promise<any> {
    try {
      // Using /v1/files/:key/meta endpoint which returns { file: { ... } }
      const metadataResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}/meta`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      if (metadataResponse.ok) {
        const metadataData = await metadataResponse.json();
        // Extract the file property from the response
        const fileMetadata = metadataData.file || metadataData;
        console.log(
          chalk.green(`✅ Fetched file metadata for ${fileKey}:`),
          fileMetadata?.name || 'unknown file'
        );
        return fileMetadata;
      } else {
        const errorText = await metadataResponse.text();
        console.error(
          chalk.yellow(`Failed to fetch file metadata for ${fileKey}:`),
          errorText
        );
        return null;
      }
    } catch (error) {
      console.error(chalk.red("Error fetching file metadata:"), error);
      return null;
    }
  }

  /**
   * Parse client_meta positioning data from Figma comment
   * Returns the positioning type and normalized data structure
   */
  function parsePositioningData(clientMeta: any): {
    type: 'Vector' | 'FrameOffset' | 'Region' | 'FrameOffsetRegion';
    data: any;
  } | null {
    if (!clientMeta || typeof clientMeta !== 'object') {
      return null;
    }

    // Check for Vector: { x: number, y: number }
    if (typeof clientMeta.x === 'number' && typeof clientMeta.y === 'number' && !clientMeta.width && !clientMeta.height && !clientMeta.node_id) {
      return {
        type: 'Vector',
        data: { x: clientMeta.x, y: clientMeta.y }
      };
    }

    // Check for FrameOffset: { node_id: string, node_offset: { x: number, y: number } }
    if (clientMeta.node_id && clientMeta.node_offset && typeof clientMeta.node_offset.x === 'number' && typeof clientMeta.node_offset.y === 'number') {
      return {
        type: 'FrameOffset',
        data: {
          node_id: clientMeta.node_id,
          node_offset: { x: clientMeta.node_offset.x, y: clientMeta.node_offset.y }
        }
      };
    }

    // Check for Region: { x: number, y: number, width: number, height: number }
    if (typeof clientMeta.x === 'number' && typeof clientMeta.y === 'number' && typeof clientMeta.width === 'number' && typeof clientMeta.height === 'number' && !clientMeta.node_id) {
      return {
        type: 'Region',
        data: {
          x: clientMeta.x,
          y: clientMeta.y,
          width: clientMeta.width,
          height: clientMeta.height
        }
      };
    }

    // Check for FrameOffsetRegion: Combination of FrameOffset and Region
    if (clientMeta.node_id && clientMeta.node_offset && typeof clientMeta.x === 'number' && typeof clientMeta.y === 'number' && typeof clientMeta.width === 'number' && typeof clientMeta.height === 'number') {
      return {
        type: 'FrameOffsetRegion',
        data: {
          node_id: clientMeta.node_id,
          node_offset: clientMeta.node_offset,
          x: clientMeta.x,
          y: clientMeta.y,
          width: clientMeta.width,
          height: clientMeta.height
        }
      };
    }

    // Also check for node_id-only positioning (common case)
    if (clientMeta.node_id) {
      return {
        type: 'FrameOffset',
        data: {
          node_id: clientMeta.node_id,
          node_offset: clientMeta.node_offset || { x: 0, y: 0 }
        }
      };
    }

    return null;
  }

  /**
   * Webhook handler for Figma comment events
   * POST /webhooks/figma
   */
  export const handleFigmaWebhook = async (req: Request, res: Response) => {
    console.log(
      chalk.bgMagenta.white("Figma webhook received:"),
      chalk.magentaBright(JSON.stringify(req.body, null, 2))
    );

    try {
      const webhookEvent = req.body;
      const eventType = webhookEvent.event_type;
      
      // Figma webhook payload structure (based on Figma API docs)
      // Supported event types: FILE_COMMENT (comments) and FILE_UPDATE (design changes)
      if (!['FILE_COMMENT', 'FILE_UPDATE'].includes(eventType) || !webhookEvent.file_key) {
        console.log(chalk.yellow(`⚠️  Ignoring unsupported event type ${eventType} or missing file_key`));
        res.status(200).json({ received: true });
        return;
      }

      const fileKey = webhookEvent.file_key;
      const receivedPasscode = req.headers['x-figma-passcode'] || req.body.passcode;

      // Acknowledge immediately to prevent retries
      res.status(200).json({ received: true });

      // Find all active automations that match this file_key (regardless of team_id)
      // Figma webhook events don't include team_id, so we match on file_key from automation_figma_configs
      const matchingInputs = await db().automation_inputs.findMany({
        where: {
          integration_type: IntegrationType.FIGMA,
          automation: {
            is_active: true,
          },
          figma_config: {
            file_key: fileKey,
          },
        },
        include: {
          figma_config: true,
          automation: {
            include: {
              prompt: true,
              output: {
                include: {
                  figma_config: true,
                },
              },
              user: {
                include: {
                  figma_integrations: true,
                },
              },
            },
          },
        },
      });

      if (matchingInputs.length === 0) {
        console.log(
          chalk.yellow(
            `⚠️  No active automations found for file ${fileKey}`
          )
        );
        return;
      }

      // Group automations by user/integration for processing
      const automationsToProcess: Array<{
        automationInputs: any[];
        integration: any;
      }> = [];

      // Group by user and get their Figma integration
      const userIntegrationMap = new Map<string, any>();
      
      for (const input of matchingInputs) {
        const userId = input.automation.user_id;
        
        if (!userIntegrationMap.has(userId)) {
          // Get the user's Figma integration
          const integration = await db().figma_integrations.findFirst({
            where: {
              user_id: userId,
            },
            orderBy: {
              created_at: 'desc',
            },
          });

          if (!integration) {
            console.log(chalk.yellow(`⚠️  No Figma integration found for user ${userId}`));
            continue;
          }

          userIntegrationMap.set(userId, integration);
        }

        const integration = userIntegrationMap.get(userId);
        
        // Find existing entry for this integration or create new one
        let existingEntry = automationsToProcess.find(
          entry => entry.integration.id === integration.id
        );

        if (!existingEntry) {
          existingEntry = {
            automationInputs: [],
            integration: {
              ...integration,
              user: input.automation.user,
            },
          };
          automationsToProcess.push(existingEntry);
        }

        existingEntry.automationInputs.push(input);
      }

      if (automationsToProcess.length === 0) {
        console.log(
          chalk.yellow(
            `⚠️  No active automations with valid integrations found for file ${fileKey}`
          )
        );
        return;
      }

      // Verify passcode if provided (check against any webhook for the integrations)
      if (receivedPasscode) {
        const integrationIds = automationsToProcess.map(a => a.integration.id);
        const matchingWebhook = await db().figma_webhooks.findFirst({
          where: {
            figma_integration_id: { in: integrationIds },
            passcode: receivedPasscode,
            event_type: eventType,
          },
        });

        if (!matchingWebhook) {
          console.log(chalk.red(`❌ Invalid passcode for webhook`));
          return; // Already acknowledged, just return
        }
        console.log(chalk.green(`✅ Passcode verified for webhook ${matchingWebhook.id}`));
      } else {
        console.log(chalk.yellow(`⚠️  No passcode provided in webhook request`));
      }

      // Process webhook based on event type
      if (eventType === 'FILE_COMMENT') {
        // FILE_COMMENT events contain comment data in the payload
        await handleFigmaCommentEvent(automationsToProcess, webhookEvent, fileKey);
      } else if (eventType === 'FILE_UPDATE') {
        // FILE_UPDATE events indicate design changes - fetch comments and track changes
        await handleFigmaFileUpdateEvent(automationsToProcess, webhookEvent, fileKey);
      }
    } catch (error) {
      console.error(chalk.red("Error in handleFigmaWebhook:"), error);
    }
  }

  /**
   * Map comment position to design elements in the file
   * Returns array of node IDs that match the comment position
   */
  async function mapCommentToDesignElements(
    accessToken: string,
    fileKey: string,
    positioningData: { type: string; data: any } | null,
    existingNodeId?: string
  ): Promise<string[]> {
    const matchedNodeIds: string[] = [];

    try {
      // If we already have a node_id from client_meta, use it
      if (existingNodeId) {
        matchedNodeIds.push(existingNodeId);
      }

      // If no positioning data, try to get root page/document nodes for file-level comments
      if (!positioningData) {
        // For file-level comments, try to get the document root or first page
        try {
          const fileResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}?geometry=paths`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
            },
          });

          if (fileResponse.ok) {
            const fileData = await fileResponse.json();
            const document = fileData.document;

            if (document) {
              // Get root page nodes (CANVAS type) or the document itself
              const findRootPages = (node: any, pages: string[] = []): void => {
                // CANVAS nodes are typically pages in Figma
                if (node.type === 'CANVAS' || node.type === 'FRAME') {
                  pages.push(node.id);
                }
                // Limit to first 3 pages to avoid too many
                if (node.children && pages.length < 3) {
                  for (const child of node.children) {
                    findRootPages(child, pages);
                  }
                }
              };

              const rootPages: string[] = [];
              findRootPages(document, rootPages);
              
              // Add root pages to matched nodes for file-level comments
              for (const pageId of rootPages) {
                if (!matchedNodeIds.includes(pageId)) {
                  matchedNodeIds.push(pageId);
                }
              }

              // If no pages found, use the document root itself
              if (matchedNodeIds.length === 0 && document.id) {
                matchedNodeIds.push(document.id);
              }
            }
          }
        } catch (error) {
          console.error(chalk.yellow(`Error fetching file for file-level comment context:`), error);
        }
        
        return matchedNodeIds;
      }

      // Fetch full file JSON to get all nodes and their positions
      const fileResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}?geometry=paths`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      if (!fileResponse.ok) {
        console.error(chalk.yellow(`Failed to fetch file JSON for ${fileKey}:`), await fileResponse.text());
        return matchedNodeIds; // Return existing node_id if we have it
      }

      const fileData = await fileResponse.json();
      const document = fileData.document;

      if (!document) {
        return matchedNodeIds;
      }

      // Helper function to recursively find all nodes with their bounds
      const findNodesWithBounds = (node: any, nodes: Array<{ id: string; bounds: any; name: string }> = []): void => {
        if (node.absoluteBoundingBox || node.relativeTransform) {
          const bounds = node.absoluteBoundingBox || {
            x: node.relativeTransform?.[0]?.[2] || 0,
            y: node.relativeTransform?.[1]?.[2] || 0,
            width: node.absoluteBoundingBox?.width || 0,
            height: node.absoluteBoundingBox?.height || 0,
          };

          nodes.push({
            id: node.id,
            bounds: bounds,
            name: node.name || 'Unnamed',
          });
        }

        if (node.children) {
          for (const child of node.children) {
            findNodesWithBounds(child, nodes);
          }
        }
      };

      const allNodes: Array<{ id: string; bounds: any; name: string }> = [];
      findNodesWithBounds(document, allNodes);

      // Match based on positioning type
      if (positioningData.type === 'Vector') {
        // For Vector, find nodes that contain the point
        const { x, y } = positioningData.data;
        for (const node of allNodes) {
          const bounds = node.bounds;
          if (bounds && 
              x >= bounds.x && 
              x <= bounds.x + bounds.width &&
              y >= bounds.y && 
              y <= bounds.y + bounds.height) {
            if (!matchedNodeIds.includes(node.id)) {
              matchedNodeIds.push(node.id);
            }
          }
        }
      } else if (positioningData.type === 'Region') {
        // For Region, find nodes that overlap with the region
        const { x, y, width, height } = positioningData.data;
        const regionBounds = { x, y, width, height };
        
        for (const node of allNodes) {
          const bounds = node.bounds;
          if (bounds && 
              !(regionBounds.x + regionBounds.width < bounds.x ||
                regionBounds.x > bounds.x + bounds.width ||
                regionBounds.y + regionBounds.height < bounds.y ||
                regionBounds.y > bounds.y + bounds.height)) {
            // Overlaps
            if (!matchedNodeIds.includes(node.id)) {
              matchedNodeIds.push(node.id);
            }
          }
        }
      } else if (positioningData.type === 'FrameOffset' || positioningData.type === 'FrameOffsetRegion') {
        // For FrameOffset, the node_id is already in the data
        const nodeId = positioningData.data.node_id;
        if (nodeId && !matchedNodeIds.includes(nodeId)) {
          matchedNodeIds.push(nodeId);
        }

        // For FrameOffsetRegion, also check region overlap
        if (positioningData.type === 'FrameOffsetRegion' && positioningData.data.x !== undefined) {
          const { x, y, width, height } = positioningData.data;
          const regionBounds = { x, y, width, height };
          
          for (const node of allNodes) {
            const bounds = node.bounds;
            if (bounds && 
                !(regionBounds.x + regionBounds.width < bounds.x ||
                  regionBounds.x > bounds.x + bounds.width ||
                  regionBounds.y + regionBounds.height < bounds.y ||
                  regionBounds.y > bounds.y + bounds.height)) {
              if (!matchedNodeIds.includes(node.id)) {
                matchedNodeIds.push(node.id);
              }
            }
          }
        }
      }

      // Sort by specificity (smaller nodes first, as they're more specific)
      matchedNodeIds.sort((id1, id2) => {
        const node1 = allNodes.find(n => n.id === id1);
        const node2 = allNodes.find(n => n.id === id2);
        if (!node1 || !node2) return 0;
        const area1 = (node1.bounds?.width || 0) * (node1.bounds?.height || 0);
        const area2 = (node2.bounds?.width || 0) * (node2.bounds?.height || 0);
        return area1 - area2;
      });

    } catch (error) {
      console.error(chalk.red("Error mapping comment to design elements:"), error);
      // Return existing node_id if we have it, even if mapping failed
    }

    return matchedNodeIds;
  }

  /**
   * Extract images for comment context from Figma API
   * Returns object with image URLs for different context levels
   */
  async function extractCommentImages(
    accessToken: string,
    fileKey: string,
    nodeIds: string[],
    positioningData: { type: string; data: any } | null
  ): Promise<{
    nodeImage?: string;
    contextImage?: string;
    fullFrame?: string;
  }> {
    const imageUrls: {
      nodeImage?: string;
      contextImage?: string;
      fullFrame?: string;
    } = {};

    try {
      if (nodeIds.length === 0) {
        // No nodes to extract - might be file-level comment
        // For file-level comments, try to extract the first page/document
        if (!positioningData) {
          // Try to get document root or first page
          try {
            const fileResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${accessToken}`,
              },
            });

            if (fileResponse.ok) {
              const fileData = await fileResponse.json();
              const document = fileData.document;

              if (document) {
                // Find first CANVAS (page) or use document root
                let pageNodeId: string | null = null;
                
                const findFirstPage = (node: any): void => {
                  if (node.type === 'CANVAS' || (node.type === 'FRAME' && !pageNodeId)) {
                    pageNodeId = node.id;
                  }
                  if (!pageNodeId && node.children) {
                    for (const child of node.children) {
                      findFirstPage(child);
                      if (pageNodeId) break;
                    }
                  }
                };

                findFirstPage(document);
                
                const targetNodeId = pageNodeId || document.id;
                
                if (targetNodeId) {
                  const imageResponse = await fetch(
                    `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(targetNodeId)}&format=png&scale=1`,
                    {
                      method: "GET",
                      headers: {
                        "Authorization": `Bearer ${accessToken}`,
                      },
                    }
                  );

                  if (imageResponse.ok) {
                    const imageData = await imageResponse.json();
                    if (imageData.images && imageData.images[targetNodeId]) {
                      imageUrls.fullFrame = imageData.images[targetNodeId];
                      console.log(chalk.blue(`📄 Extracted full page image for file-level comment`));
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error(chalk.yellow(`Error extracting file-level comment image:`), error);
          }
        }
        return imageUrls;
      }

      // Primary node image - the specific node the comment is on
      const primaryNodeId = nodeIds[0];
      if (primaryNodeId) {
        const imageResponse = await fetch(
          `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(primaryNodeId)}&format=png&scale=2`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
            },
          }
        );

        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          if (imageData.images && imageData.images[primaryNodeId]) {
            imageUrls.nodeImage = imageData.images[primaryNodeId];
          }
        } else {
          console.error(chalk.yellow(`Failed to extract node image for ${primaryNodeId}:`), await imageResponse.text());
        }
      }

      // For context image, try to get parent frame or surrounding area
      // If we have a region, we can extract a larger area
      if (positioningData?.type === 'Region' || positioningData?.type === 'FrameOffsetRegion') {
        // For region-based comments, extract the region area
        // We'll need to find the parent frame that contains the region
        // For now, use the primary node's parent if available
        // This could be enhanced to calculate the actual region bounds
        if (nodeIds.length > 0) {
          // Try to extract a context image using the primary node
          // In a more sophisticated implementation, we could calculate the region bounds
          // and extract a custom area, but Figma API requires node IDs
          const contextResponse = await fetch(
            `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(nodeIds.slice(0, 3).join(','))}&format=png&scale=1`,
            {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${accessToken}`,
              },
            }
          );

          if (contextResponse.ok) {
            const contextData = await contextResponse.json();
            if (contextData.images) {
              // Use the first available image as context
              const firstImageUrl = Object.values(contextData.images)[0];
              if (firstImageUrl && typeof firstImageUrl === 'string') {
                imageUrls.contextImage = firstImageUrl;
              }
            }
          }
        }
      } else if (nodeIds.length > 1) {
        // Multiple nodes matched - extract context with multiple nodes
        const contextNodeIds = nodeIds.slice(0, 5).join(','); // Limit to 5 nodes
        const contextResponse = await fetch(
          `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(contextNodeIds)}&format=png&scale=1`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
            },
          }
        );

        if (contextResponse.ok) {
          const contextData = await contextResponse.json();
          if (contextData.images) {
            const firstImageUrl = Object.values(contextData.images)[0];
            if (firstImageUrl && typeof firstImageUrl === 'string') {
              imageUrls.contextImage = firstImageUrl;
            }
          }
        }
      }

      // Full frame image - try to get the page/frame containing the comment
      // This is optional and can be expensive, so we'll skip it for now
      // Can be added later if needed

      // Set expiry time (24 hours from now, Figma images typically expire in 24-48 hours)
      // This will be stored in the database

    } catch (error) {
      console.error(chalk.red("Error extracting comment images:"), error);
      // Don't throw - image extraction is optional, continue without images
    }

    return imageUrls;
  }

  /**
   * Internal helper to process a Figma comment and trigger automations
   */
  async function processFigmaCommentInternal(
    integration: any,
    comment: any,
    fileKey: string,
    accessToken: string,
  ) {
    const commentId = comment.id;
    console.log(
      chalk.cyan(`New Figma comment received: ${commentId} on file ${fileKey}`)
    );

    // Fetch file metadata
    const fileMetadata = await fetchFileMetadata(accessToken, fileKey);

    // Extract and parse positioning data
    const positioningData = parsePositioningData(comment.client_meta);
    console.log(
      chalk.blue(`📍 Positioning data for comment ${commentId}:`),
      positioningData ? JSON.stringify(positioningData, null, 2) : 'null (empty client_meta)'
    );

    // Map comment to design elements using positioning data
    let matchedNodeIds: string[] = [];
    try {
      const nodeId = comment.client_meta?.node_id;
      matchedNodeIds = await mapCommentToDesignElements(
        accessToken,
        fileKey,
        positioningData,
        nodeId
      );
      console.log(
        chalk.blue(`🎯 Matched ${matchedNodeIds.length} node(s) for comment ${commentId}:`),
        matchedNodeIds.length > 0 ? matchedNodeIds.join(', ') : 'none'
      );
    } catch (error) {
      console.error(
        chalk.red(`Error mapping comment ${commentId} to design elements:`),
        error
      );
      // Continue with empty array if mapping fails
    }

    // Extract images for visual context
    let imageUrls: {
      nodeImage?: string;
      contextImage?: string;
      fullFrame?: string;
    } = {};
    try {
      imageUrls = await extractCommentImages(
        accessToken,
        fileKey,
        matchedNodeIds,
        positioningData
      );
      console.log(
        chalk.blue(`🖼️  Extracted images for comment ${commentId}:`),
        Object.keys(imageUrls).length > 0 
          ? `${Object.keys(imageUrls).length} image(s) extracted` 
          : 'no images extracted'
      );
    } catch (error) {
      console.error(
        chalk.red(`Error extracting images for comment ${commentId}:`),
        error
      );
      // Continue with empty object if image extraction fails
    }

    // Calculate image expiry (24 hours from now)
    const imageExpiry = imageUrls.nodeImage || imageUrls.contextImage || imageUrls.fullFrame
      ? new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      : null;

    // Get the closest node ID for storage
    const closestNodeId = matchedNodeIds.length > 0 
      ? matchedNodeIds[0] 
      : (comment.client_meta?.node_id || null);

    // Store enriched context for AI/documentation
    try {
      await db().figma_comment_context.create({
        data: {
          figma_integration_id: integration.id,
          comment_id: commentId,
          file_key: fileKey,
          node_id: closestNodeId,
          comment_data: comment,
          file_metadata: fileMetadata ? JSON.parse(JSON.stringify(fileMetadata)) : null,
          positioning_data: positioningData ? JSON.parse(JSON.stringify(positioningData)) : null,
          matched_node_ids: matchedNodeIds,
          image_urls: Object.keys(imageUrls).length > 0 ? JSON.parse(JSON.stringify(imageUrls)) : null,
          image_expiry: imageExpiry,
        },
      });
      console.log(
        chalk.green(`✅ Stored enriched context for comment ${commentId}`),
        chalk.gray(`- Positioning: ${positioningData ? positioningData.type : 'none'}, Nodes: ${matchedNodeIds.length}, Images: ${Object.keys(imageUrls).length}`)
      );
    } catch (error) {
      console.error(
        chalk.red(`❌ Error storing enriched context for comment ${commentId}:`),
        error
      );
      // Don't throw - continue processing even if storage fails
    }

    // Create event data with enriched context
    const eventData: FigmaCommentEventData = {
      commentId: comment.id,
      fileKey: fileKey,
      fileUrl: `https://www.figma.com/file/${fileKey}`,
      nodeId: closestNodeId || undefined,
      message: comment.message,
      author: {
        id: comment.user.id,
        handle: comment.user.handle || comment.user.email || "Unknown",
        img_url: comment.user.img_url,
      },
      createdAt: comment.created_at,
      resolved: comment.resolved_at !== null,
      fileMetadata: fileMetadata,
      positioningData: positioningData ? {
        type: positioningData.type as 'Vector' | 'FrameOffset' | 'Region' | 'FrameOffsetRegion',
        data: positioningData.data
      } : undefined,
      matchedNodeIds: matchedNodeIds.length > 0 ? matchedNodeIds : undefined,
      imageUrls: Object.keys(imageUrls).length > 0 ? imageUrls : undefined,
    };

    // Process the event through the automation system
    const figmaEvent = new FigmaCommentEvent(eventData);
    const eventProcessor = new EventProcessor(figmaEvent, integration.user as User);
    const results = await eventProcessor.process();

    // Log results
    let hasSuccess = false;
    for (const result of results) {
      if (result.success) {
        hasSuccess = true;
        console.log(
          chalk.green(
            `✅ Automation "${result.automation?.name}" triggered for comment ${commentId}`
          )
        );
      }
    }

    if (!hasSuccess) {
      console.log(
        chalk.yellow(
          `No automations matched comment ${commentId} on file ${fileKey}`
        )
      );
    }
  }

  /**
   * Handle FILE_COMMENT webhook events
   * Comment data is included in the webhook payload
   * Note: client_meta is not included in webhook payload, so we fetch it from the comment API
   */
  async function handleFigmaCommentEvent(
    automationsToProcess: Array<{
      automationInputs: any[];
      integration: any;
    }>,
    webhookEvent: any,
    fileKey: string
  ) {
    // Extract comment_id from top level (Figma webhook structure)
    const commentId = webhookEvent.comment_id;
    
    if (!commentId) {
      console.log(chalk.yellow(`⚠️  FILE_COMMENT event missing comment_id`));
      console.log(chalk.yellow(`Webhook event: ${JSON.stringify(webhookEvent, null, 2)}`));
      return;
    }

    console.log(
      chalk.blue(`📝 Processing FILE_COMMENT event for file ${fileKey}, comment ${commentId}`)
    );

    // Fetch comment details from Figma API once to get client_meta
    // client_meta is not included in the webhook payload
    // Use the first valid integration's token to fetch the comment
    let commentFromApi: any = null;
    for (const { integration } of automationsToProcess) {
      // Check if token is expired
      if (integration.token_expiry && new Date() > integration.token_expiry) {
        continue; // Try next integration
      }

      try {
        const commentsResponse = await fetch(
          `https://api.figma.com/v1/files/${fileKey}/comments`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${integration.access_token}`,
            },
          }
        );

        if (!commentsResponse.ok) {
          console.error(
            chalk.yellow(`Failed to fetch comments for file ${fileKey} with integration ${integration.id}:`),
            await commentsResponse.text()
          );
          continue; // Try next integration
        }

        const commentsData = await commentsResponse.json();
        const comments = commentsData.comments || [];
        
        // Find the comment with matching ID
        commentFromApi = comments.find((c: any) => c.id === commentId);
        
        if (commentFromApi) {
          console.log(
            chalk.green(`✅ Fetched comment ${commentId} from API with client_meta`)
          );
          break; // Successfully fetched, no need to try other integrations
        } else {
          console.log(
            chalk.yellow(`⚠️  Comment ${commentId} not found in API response`)
          );
        }
      } catch (error) {
        console.error(
          chalk.yellow(`⚠️  Error fetching comment from API with integration ${integration.id}:`),
          error
        );
        // Continue to try next integration
      }
    }

    if (!commentFromApi) {
      console.log(
        chalk.yellow(`⚠️  Could not fetch comment ${commentId} from API, using webhook data only`)
      );
    }

    // Build normalized comment object, preferring API data over webhook data
    // Use API data if available (has client_meta), otherwise fall back to webhook data
    const commentText = commentFromApi?.message 
      || (webhookEvent.comment && Array.isArray(webhookEvent.comment) && webhookEvent.comment.length > 0
        ? webhookEvent.comment[0].text
        : '');
    
    // Handle resolved_at - Figma sends empty string for unresolved comments
    const resolvedAt = commentFromApi?.resolved_at 
      || (webhookEvent.resolved_at && webhookEvent.resolved_at.trim() !== ''
        ? webhookEvent.resolved_at
        : null);
    
    const normalizedComment = {
      id: commentId,
      message: commentText,
      created_at: commentFromApi?.created_at || webhookEvent.created_at,
      resolved_at: resolvedAt,
      user: commentFromApi?.user || webhookEvent.triggered_by || {
        id: '',
        handle: '',
        email: '',
        img_url: ''
      },
      client_meta: commentFromApi?.client_meta || webhookEvent.client_meta || {}
    };

    for (const { integration, automationInputs } of automationsToProcess) {
      try {
        const accessToken = integration.access_token;

        // Check if token is expired
        if (integration.token_expiry && new Date() > integration.token_expiry) {
          console.log(
            chalk.red(`❌ Token expired for integration ${integration.id}, skipping`)
          );
          continue;
        }
        
        // Check if we've already processed this comment
        const existing = await db().processed_figma_comments.findFirst({
          where: {
            figma_integration_id: integration.id,
            comment_id: commentId,
          },
        });

        if (existing) {
          console.log(chalk.blue(`ℹ️  Comment ${commentId} already processed`));
          continue;
        }

        // Mark as processed
        try {
          await db().processed_figma_comments.create({
            data: {
              figma_integration_id: integration.id,
              comment_id: commentId,
              file_key: fileKey,
            },
          });
        } catch (error: any) {
          // Race condition - comment already being processed
          if (error.code === 'P2002') {
            console.log(chalk.blue(`ℹ️  Comment ${commentId} already being processed`));
            continue;
          }
          throw error;
        }
        

        // Process the comment for each matching automation input
        for (const automationInput of automationInputs) {
          await processFigmaCommentInternal(integration, normalizedComment, fileKey, accessToken);
        }
      } catch (error) {
        console.error(
          chalk.red(`❌ Error processing FILE_COMMENT for integration ${integration.id}:`),
          error
        );
      }
    }
  }

  /**
   * Handle FILE_UPDATE webhook events
   * These indicate design changes - we fetch comments to check for new ones
   */
  async function handleFigmaFileUpdateEvent(
    automationsToProcess: Array<{
      automationInputs: any[];
      integration: any;
    }>,
    webhookEvent: any,
    fileKey: string
  ) {
    console.log(
      chalk.blue(`🎨 Processing FILE_UPDATE event for file ${fileKey} (design change)`)
    );

    for (const { integration, automationInputs } of automationsToProcess) {
      try {
        const accessToken = integration.access_token;

        // Check if token is expired
        if (integration.token_expiry && new Date() > integration.token_expiry) {
          console.log(
            chalk.red(`❌ Token expired for integration ${integration.id}, skipping`)
          );
          continue;
        }

        // Fetch comments for this file to check for new ones
        const commentsResponse = await fetch(
          `https://api.figma.com/v2/files/${fileKey}/comments`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
            },
          }
        );

        if (!commentsResponse.ok) {
          console.error(
            chalk.red(`Failed to fetch comments for file ${fileKey}:`),
            await commentsResponse.text()
          );
          continue;
        }

        const commentsData = await commentsResponse.json();
        const comments = commentsData.comments || [];

          // Get the most recent processed comment timestamp to only process new ones
          const lastProcessed = await db().processed_figma_comments.findFirst({
            where: {
              figma_integration_id: integration.id,
              file_key: fileKey,
            },
            orderBy: {
              processed_at: 'desc',
            },
          });

          // Process comments (only new ones if we have a last processed timestamp)
          for (const comment of comments) {
            const commentId = comment.id;
            const commentCreatedAt = new Date(comment.created_at);

            // Skip if we've already processed this comment
            if (lastProcessed) {
              const lastProcessedAt = lastProcessed.processed_at;
              if (commentCreatedAt <= lastProcessedAt) {
                continue; // This comment is older than our last processed one
              }
            }

            // Check if we've already processed this specific comment (race condition protection)
            const existing = await db().processed_figma_comments.findFirst({
              where: {
                figma_integration_id: integration.id,
                comment_id: commentId,
              },
            });

            if (existing) {
              continue; // Already processed
            }

            // Try to mark as processed (with unique constraint to prevent race conditions)
            try {
              await db().processed_figma_comments.create({
                data: {
                  figma_integration_id: integration.id,
                  comment_id: commentId,
                  file_key: fileKey,
                },
              });
            } catch (error: any) {
              // If unique constraint fails, this comment was already processed
              if (error.code === "P2002") {
                console.log(
                  chalk.yellow(`Skipping already processed comment ${commentId}`)
                );
                continue;
              }
              throw error;
            }

            // Process the comment for each matching automation input
            for (const automationInput of automationInputs) {
              await processFigmaCommentInternal(integration, comment, fileKey, accessToken);
            }
          }
      } catch (error) {
        console.error(
          chalk.red(`Error processing webhook for integration ${integration.id}:`),
          error
        );
        // Continue with other integrations even if one fails
      }
    }
  }