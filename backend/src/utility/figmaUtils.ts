import chalk from "chalk";
import { db } from "../prismaClient";
import {
  FigmaCommentImageUrls,
  FigmaPositioningData,
  FigmaApiComment,
} from "../shared/types";


/**
 * Get Figma access token for a user
 */
export async function getFigmaAccessToken(userId: string): Promise<string> {
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

/**
 * Fetch file metadata for a file
 */
export async function fetchFileMetadata(
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
export function parsePositioningData(clientMeta: any): FigmaPositioningData | null {
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
 * Map comment position to design elements in the file
 * Returns array of node IDs that match the comment position
 */
export async function mapCommentToDesignElements(
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
              regionBounds.x > bounds.x + regionBounds.width ||
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
export async function extractCommentImages(
  accessToken: string,
  fileKey: string,
  nodeIds: string[],
  positioningData: { type: string; data: any } | null
): Promise<FigmaCommentImageUrls> {
  const imageUrls: FigmaCommentImageUrls = {};

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

    // Full frame image - extract the page/frame containing the comment
    // Find the page (CANVAS) that contains the primary node
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

        if (document && primaryNodeId) {
          // Find the page (CANVAS) that contains the primary node
          let pageNodeId: string | null = null;
          
          const findPageForNode = (node: any, targetId: string): void => {
            if (node.type === 'CANVAS') {
              // Check if this page contains the target node
              const containsNode = (n: any): boolean => {
                if (n.id === targetId) return true;
                if (n.children) {
                  return n.children.some((child: any) => containsNode(child));
                }
                return false;
              };
              
              if (containsNode(node)) {
                pageNodeId = node.id;
                return;
              }
            }
            
            if (node.children && !pageNodeId) {
              for (const child of node.children) {
                findPageForNode(child, targetId);
                if (pageNodeId) break;
              }
            }
          };

          findPageForNode(document, primaryNodeId);
          
          const targetFrameId = pageNodeId || primaryNodeId;

          if (targetFrameId) {
            const fullFrameResponse = await fetch(
              `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(targetFrameId)}&format=png&scale=1`,
              {
                method: "GET",
                headers: {
                  "Authorization": `Bearer ${accessToken}`,
                },
              }
            );

            if (fullFrameResponse.ok) {
              const fullFrameData = await fullFrameResponse.json();
              if (fullFrameData.images && fullFrameData.images[targetFrameId]) {
                imageUrls.fullFrame = fullFrameData.images[targetFrameId];
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(chalk.yellow(`Error extracting full frame image:`), error);
      // Continue without full frame image
    }

  } catch (error) {
    console.error(chalk.red("Error extracting comment images:"), error);
    // Don't throw - image extraction is optional, continue without images
  }

  return imageUrls;
}


/**
 * Fetch comment from Figma API using a single integration
 */
export async function fetchFigmaCommentThreadFromApi(
  accessToken: string,
  fileKey: string,
  commentId: string
): Promise<{ comment: FigmaApiComment; thread: FigmaApiComment[] } | null> {
  try {
    const commentsResponse = await fetch(
      `https://api.figma.com/v1/files/${fileKey}/comments`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      }
    );

    if (!commentsResponse.ok) {
      console.error(
        chalk.yellow(`Failed to fetch comments for file ${fileKey}`),
        await commentsResponse.text()
      );
      return null;
    }

    const commentsData = await commentsResponse.json();
    const comments = (commentsData.comments || []) as FigmaApiComment[];

    if (!Array.isArray(comments) || comments.length === 0) {
      return null;
    }

    const commentMap = new Map<string, FigmaApiComment>();
    for (const rawComment of comments) {
      commentMap.set(rawComment.id, rawComment);
    }

    const targetComment = commentMap.get(commentId);

    if (!targetComment) {
      return null;
    }

    const findRootComment = (comment: FigmaApiComment): FigmaApiComment => {
      let current: FigmaApiComment = comment;
      const visited = new Set<string>();

      while (current.parent_id) {
        if (visited.has(current.parent_id)) {
          break;
        }

        visited.add(current.parent_id);
        const parent = commentMap.get(current.parent_id);
        if (!parent) {
          break;
        }
        current = parent;
      }

      return current;
    };

    const rootComment = findRootComment(targetComment);
    const rootOrderId = rootComment.order_id || rootComment.id;

    const threadComments = comments
      .filter((comment) => {
        if (comment.id === rootComment.id) {
          return true;
        }

        // Prefer order_id when available (covers replies and nested replies)
        if (rootOrderId && comment.order_id) {
          return comment.order_id === rootOrderId;
        }

        // Fallback: walk up the parent chain to see if it reaches the root comment
        let current: FigmaApiComment | undefined = comment;
        const visited = new Set<string>();
        while (current?.parent_id) {
          if (visited.has(current.parent_id)) {
            break;
          }
          visited.add(current.parent_id);

          if (current.parent_id === rootComment.id) {
            return true;
          }

          current = commentMap.get(current.parent_id);
        }

        return false;
      })
      .sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return aTime - bTime;
      });

    const threadList = threadComments.length > 0 ? threadComments : [targetComment];

    return {
      comment: targetComment,
      thread: threadList,
    };
  } catch (error) {
    console.error(
      chalk.yellow(`⚠️  Error fetching comment from API with file key ${fileKey}`),
      error
    );
    return null;
  }
}

export function findRootThreadComment(
  thread: FigmaApiComment[],
  fallback: FigmaApiComment
): FigmaApiComment {
  if (thread.length === 0) {
    return fallback;
  }

  const explicitRoot = thread.find((comment) => !comment.parent_id);
  if (explicitRoot) {
    return explicitRoot;
  }

  return thread[0] ?? fallback;
}

export function resolvePositioningContext(
  targetComment: FigmaApiComment,
  thread: FigmaApiComment[]
): {
  rootComment: FigmaApiComment;
  positioningComment: FigmaApiComment;
  positioningData: FigmaPositioningData | null;
} {
  const rootComment = findRootThreadComment(thread, targetComment);

  const orderedCandidates = [targetComment, ...thread.filter((comment) => comment.id !== targetComment.id)];
  const candidateWithMeta = orderedCandidates.find((comment) => comment.client_meta);
  const positioningComment = candidateWithMeta ?? (rootComment.client_meta ? rootComment : targetComment);

  const positioningData = parsePositioningData(positioningComment?.client_meta ?? null);

  return {
    rootComment,
    positioningComment,
    positioningData,
  };
}