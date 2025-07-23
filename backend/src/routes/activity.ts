import { Request, Response } from "express";
import { db } from "../prismaClient";
import { ActivityEvent } from "../shared/types";
import { callOpenAISummary } from '../utility/openai';

interface PaginationQuery {
    cursor?: string; // ISO timestamp string
    limit?: string; // number as string
}

interface PaginatedResponse {
    activities: ActivityEvent[];
    pagination: {
        hasMore: boolean;
        nextCursor?: string;
        currentPage: number;
    };
}

interface RawActivityRow {
    id: string;
    title: string;
    event_type: string;
    created_at: Date;
    github_username: string | null;
    repository_name: string | null;
    sub_activity_summary: string | null;
    commit_sha: string | null;
    commit_message: string | null;
    commit_url: string | null;
}

export async function getActivityFeed(req: Request, res: Response) {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const { cursor, limit = "25" }: PaginationQuery = req.query;
    const limitNumber = Math.min(parseInt(limit), 50); // Cap at 50 items max

    // Build the SQL query with proper joins and pagination
    let sql = `
        SELECT 
            ae.id,
            ae.title,
            ae.event_type,
            ae.created_at,
            u.github_username,
            gr.name as repository_name,
            sae.summary as sub_activity_summary,
            saca.commit_sha,
            saca.commit_message,
            saca.commit_url
        FROM activity_events ae
        INNER JOIN user_github_repositories ugr ON ugr.github_repository_id = ae.github_repository_id
        LEFT JOIN users u ON ae.user_id = u.id
        LEFT JOIN github_repositories gr ON ae.github_repository_id = gr.id
        LEFT JOIN sub_activity_events sae ON sae.activity_event_id = ae.id
        LEFT JOIN sub_activity_commit_associations saca ON saca.sub_activity_event_id = sae.id
        WHERE ugr.user_id = $1
    `;

    const params: (string | number)[] = [user.id];
    let paramIndex = 2;

    // Add cursor condition if provided
    if (cursor) {
        sql += ` AND ae.created_at < $${paramIndex}`;
        params.push(cursor);
        paramIndex++;
    }

    // Add ordering and limit
    sql += ` ORDER BY ae.created_at DESC, ae.id DESC LIMIT $${paramIndex}`;
    params.push(limitNumber + 1); // Take one extra to determine if there are more items

    // Execute the query
    const result = await db().$queryRawUnsafe<RawActivityRow[]>(sql, ...params);

    // Check if there are more items
    const hasMore = result.length > limitNumber;
    const paginatedResults = hasMore ? result.slice(0, limitNumber) : result;

    // Group the results by activity event
    const activityMap = new Map<string, ActivityEvent>();

    for (const row of paginatedResults) {
        const activityId = row.id;
        
        if (!activityMap.has(activityId)) {
            activityMap.set(activityId, {
                event_type: row.event_type,
                title: row.title,
                github_repository_owner_id: row.github_username || 'Unknown',
                github_repository_name: row.repository_name || 'Unknown',
                created_at: new Date(row.created_at),
                sub_activities: []
            });
        }

        const activity = activityMap.get(activityId)!;
        
        // Add sub-activity if it exists and isn't already added
        if (row.sub_activity_summary) {
            const existingSubActivity = activity.sub_activities.find(
                sa => sa.summary === row.sub_activity_summary
            );
            
            if (!existingSubActivity) {
                const subActivity = {
                    summary: row.sub_activity_summary,
                    commits: []
                };
                activity.sub_activities.push(subActivity);
            }
            
            // Add commit if it exists
            if (row.commit_sha) {
                const subActivity = activity.sub_activities.find(
                    sa => sa.summary === row.sub_activity_summary
                )!;
                
                const existingCommit = subActivity.commits.find(
                    c => c.sha === row.commit_sha
                );
                
                if (!existingCommit && row.commit_sha && row.commit_message && row.commit_url) {
                    subActivity.commits.push({
                        sha: row.commit_sha,
                        message: row.commit_message,
                        url: row.commit_url
                    });
                }
            }
        }
    }

    const activities = Array.from(activityMap.values());

    // Calculate next cursor (timestamp of the last item)
    const nextCursor = hasMore && activities.length > 0 
        ? activities[activities.length - 1].created_at.toISOString()
        : undefined;

    const response: PaginatedResponse = {
        activities,
        pagination: {
            hasMore,
            nextCursor,
            currentPage: cursor ? 2 : 1 // Simple page tracking for UI
        }
    };

    res.json(response);
}

export async function getDailyActivitySummary(req: Request, res: Response) {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    // Calculate yesterday's date range (UTC)
    const now = new Date();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); // today at 00:00 UTC
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000); // yesterday at 00:00 UTC

    console.log('Daily summary date range:', {
        start: start.toISOString(),
        end: end.toISOString(),
        userId: user.id
    });

    // Start with a simpler query to debug
    const sql = `
        SELECT 
            ae.id,
            ae.title,
            ae.event_type,
            ae.created_at,
            u.github_username,
            gr.name as repository_name
        FROM activity_events ae
        INNER JOIN user_github_repositories ugr ON ugr.github_repository_id = ae.github_repository_id
        LEFT JOIN users u ON ae.user_id = u.id
        LEFT JOIN github_repositories gr ON ae.github_repository_id = gr.id
        WHERE ugr.user_id = $1
          AND ae.created_at >= $2::timestamp
          AND ae.created_at < $3::timestamp
        ORDER BY ae.created_at ASC, ae.id ASC
    `;
    const params = [user.id, start.toISOString(), end.toISOString()];

    try {
        console.log('Executing SQL query with params:', params);
        const result = await db().$queryRawUnsafe<any[]>(sql, ...params);
        console.log('Query result count:', result.length);
        
        const eventCount = result.length;
        let summary = '';
        
        if (eventCount === 0) {
            summary = 'No activity events were recorded yesterday.';
            console.log('No events found for yesterday, using fallback summary');
        } else {
            console.log('Found events, generating AI summary for', eventCount, 'events');
            // Format events into a prompt for OpenAI
            const prompt = result.map((row, i) => {
                return `${i + 1}. [${row.event_type}] ${row.title} (${row.repository_name || 'Unknown repo'}) by ${row.github_username || 'Unknown user'} at ${row.created_at.toISOString()}`;
            }).join('\n');
            
            try {
                summary = await callOpenAISummary(`Summarize the following activity events for a daily team update.\n\n${prompt}`);
                console.log('AI summary generated successfully');
            } catch (openaiError) {
                console.error('OpenAI API error:', openaiError);
                summary = `Yesterday had ${eventCount} activity events, but there was an issue generating the summary.`;
            }
        }
        
        const response = {
            date: start.toISOString().slice(0, 10),
            summary,
            eventCount
        };
        
        console.log('Returning daily summary response:', response);
        return res.json(response);
    } catch (err) {
        console.error('Error fetching daily activity summary:', err);
        return res.status(500).json({ 
            error: 'Failed to fetch daily summary',
            details: err instanceof Error ? err.message : 'Unknown error'
        });
    }
}