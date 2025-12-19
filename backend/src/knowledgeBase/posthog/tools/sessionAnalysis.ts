import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';


export interface SessionRecording {
    id: string;
    startTime: string;
    endTime?: string;
    duration?: number;
    eventsCount: number;
    sessionUrl: string;
    personId: string;
    distinctId: string;
}

export interface ConsoleLog {
    timestamp: string;
    level: string;
    message: string;
}

export interface AnalyzeSessionOptions {
    posthogApiKey: string;
    projectId: string;
    googleApiKey: string;
    posthogHost?: string;
    userEmail?: string;
    sessionId?: string;
    outputDir?: string;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
}

export interface AnalyzeSessionResult {
    analysis: string;
    session: SessionRecording;
    sessionUrl: string;
    videoPath: string;
    analysisPath: string;
    consoleLogsPath?: string;
}

/**
 * Get session details by session ID
 */
export async function getSessionById(
    sessionId: string,
    options: {
        apiKey: string;
        projectId: string;
        host?: string;
        silent?: boolean; // If true, don't log to console
    }
): Promise<SessionRecording | null> {
    const {
        apiKey,
        projectId,
        host = 'https://us.posthog.com',
        silent = false,
    } = options;

    if (!silent) {
        console.log(`\n📡 Step 1: Fetching session ${sessionId} from PostHog...`);
    }

    // Get session recording by ID
    const recordingsUrl = `${host}/api/projects/${projectId}/session_recordings/${sessionId}/`;
    
    const recordingsResponse = await fetch(recordingsUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
    });

    if (!recordingsResponse.ok) {
        const errorText = await recordingsResponse.text();
        if (recordingsResponse.status === 401) {
            throw new Error('PostHog API key is invalid or expired.');
        } else if (recordingsResponse.status === 404) {
            throw new Error(`Session ${sessionId} not found in PostHog.`);
        }
        throw new Error(`Failed to fetch session recording: ${errorText}`);
    }

    const recording = await recordingsResponse.json();
    const sessionUrl = `${host}/replay/${sessionId}`;

    // Extract person info - handle different response structures
    const person = recording.person || recording.person_properties || {};
    const personId = person.id || person.uuid || recording.person_id || '';
    const distinctId = person.distinct_ids?.[0] || person.distinct_id || recording.distinct_id || '';

    const session: SessionRecording = {
        id: sessionId,
        startTime: recording.start_time || recording.created_at || recording.timestamp,
        endTime: recording.end_time || recording.ended_at,
        duration: recording.recording_duration || recording.duration || recording.duration_seconds,
        eventsCount: recording.events_count || recording.event_count || 0,
        sessionUrl,
        personId,
        distinctId,
    };

    if (!silent) {
        console.log(`✅ Found session: ${sessionId}`);
        console.log(`   Duration: ${session.duration}s, Events: ${session.eventsCount}`);
        console.log(`   URL: ${sessionUrl}`);
    }

    return session;
}

/**
 * Get the most recent session from PostHog by email
 */
export async function getFirstSession(
    userEmail: string,
    options: {
        apiKey: string;
        projectId: string;
        host?: string;
        limit?: number;
        dateFrom?: string;
        dateTo?: string;
        silent?: boolean; // If true, don't log to console
    }
): Promise<SessionRecording | null> {
    const {
        apiKey,
        projectId,
        host = 'https://us.posthog.com',
        limit = 1,
        dateFrom = '-7d',
        dateTo = 'now',
        silent = false,
    } = options;

    if (!silent) {
        console.log(`\n📡 Step 1: Querying PostHog sessions for ${userEmail}...`);
    }

    // Find the person by email
    const personsUrl = `${host}/api/projects/${projectId}/persons/?email=${encodeURIComponent(userEmail)}`;
    
    const personsResponse = await fetch(personsUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
    });

    if (!personsResponse.ok) {
        const errorText = await personsResponse.text();
        if (personsResponse.status === 401) {
            throw new Error('PostHog API key is invalid or expired.');
        } else if (personsResponse.status === 404) {
            throw new Error(`No person found with email ${userEmail} in PostHog.`);
        }
        throw new Error(`Failed to query PostHog persons: ${errorText}`);
    }

    const personsData = await personsResponse.json();
    const persons = Array.isArray(personsData) ? personsData : (personsData.results || []);
    
    if (persons.length === 0) {
        throw new Error(`No person found with email ${userEmail} in PostHog.`);
    }

    const person = persons[0];
    const personId = person.id || person.uuid;

    // Get session recordings
    const params = new URLSearchParams({
        limit: Math.min(limit, 100).toString(),
        offset: '0',
        person_uuid: personId,
    });

    if (dateFrom) {
        params.append('date_from', dateFrom);
    }
    if (dateTo) {
        params.append('date_to', dateTo);
    }

    const recordingsUrl = `${host}/api/projects/${projectId}/session_recordings/?${params.toString()}`;
    
    const recordingsResponse = await fetch(recordingsUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
    });

    if (!recordingsResponse.ok) {
        const errorText = await recordingsResponse.text();
        if (recordingsResponse.status === 401) {
            throw new Error('PostHog API key is invalid or expired.');
        }
        throw new Error(`Failed to query PostHog session recordings: ${errorText}`);
    }

    const recordingsData = await recordingsResponse.json();
    const recordings = Array.isArray(recordingsData) 
        ? recordingsData 
        : (recordingsData.results || recordingsData.data || []);

    if (recordings.length === 0) {
        throw new Error(`No session recordings found for ${userEmail} in the specified date range.`);
    }

    // Sort by start_time descending (latest first) to ensure we get the most recent session
    const sortedRecordings = [...recordings].sort((a: any, b: any) => {
        const timeA = new Date(a.start_time || a.created_at || a.timestamp || 0).getTime();
        const timeB = new Date(b.start_time || b.created_at || b.timestamp || 0).getTime();
        return timeB - timeA; // Descending order (most recent first)
    });

    // Get the most recent session (first after sorting)
    const recording = sortedRecordings[0];
    const sessionId = recording.id || recording.session_id || recording.uuid;
    const sessionUrl = `${host}/replay/${sessionId}`;

    const session: SessionRecording = {
        id: sessionId,
        startTime: recording.start_time || recording.created_at || recording.timestamp,
        endTime: recording.end_time || recording.ended_at,
        duration: recording.recording_duration || recording.duration || recording.duration_seconds,
        eventsCount: recording.events_count || recording.event_count || 0,
        sessionUrl,
        personId: personId,
        distinctId: person.distinct_ids?.[0] || userEmail,
    };

    if (!silent) {
        console.log(`✅ Found session: ${sessionId}`);
        console.log(`   Duration: ${session.duration}s, Events: ${session.eventsCount}`);
        console.log(`   URL: ${sessionUrl}`);
    }

    return session;
}

/**
 * Find existing export for a session by checking the exports list
 */
async function findExistingExport(
    sessionId: string,
    options: {
        apiKey: string;
        projectId: string;
        host?: string;
    }
): Promise<number | null> {
    const {
        apiKey,
        projectId,
        host = 'https://us.posthog.com',
    } = options;

    try {
        // Get list of exports
        const exportsUrl = `${host}/api/projects/${projectId}/exports/`;
        const exportsResponse = await fetch(exportsUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        if (!exportsResponse.ok) {
            return null;
        }

        const exportsData = await exportsResponse.json();
        const exports = Array.isArray(exportsData) ? exportsData : (exportsData.results || exportsData.data || []);

        // Find export for this session (check export_context.session_recording_id)
        for (const exp of exports) {
            const recordingId = exp.export_context?.session_recording_id;
            if (recordingId === sessionId) {
                return exp.id;
            }
        }

        return null;
    } catch (error) {
        // If we can't check, return null and continue with creation
        return null;
    }
}

/**
 * Export session replay as MP4 from PostHog
 */
export async function exportSessionReplay(
    sessionId: string,
    duration: number,
    options: {
        apiKey: string;
        projectId: string;
        host?: string;
        outputPath: string;
        silent?: boolean; // If true, don't log to console
    }
): Promise<string> {
    const {
        apiKey,
        projectId,
        host = 'https://us.posthog.com',
        outputPath,
        silent = false,
    } = options;

    if (!silent) {
        console.log(`\n📥 Step 2: Exporting session replay as MP4 for ${sessionId}...`);
        console.log(`   Checking for existing export...`);
    }

    // First, check if there's an existing export for this session
    let exportId: number | null = await findExistingExport(sessionId, {
        apiKey,
        projectId,
        host,
    });

    if (exportId) {
        if (!silent) {
            console.log(`   Found existing export: ${exportId}`);
        }
    } else {
        // Step 1: Create the export
        const createExportUrl = `${host}/api/projects/${projectId}/exports/`;
        const expiresAfter = new Date();
        expiresAfter.setFullYear(expiresAfter.getFullYear() + 1); // Expires in 1 year

        try {
            // Create AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

            const createExportResponse = await fetch(createExportUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    export_format: 'video/mp4',
                    export_context: {
                        session_recording_id: sessionId,
                        timestamp: 0,
                        css_selector: '.replayer-wrapper',
                        width: 1920,
                        height: 1080,
                        filename: `replay-${sessionId}`,
                        duration: duration,
                        mode: 'video',
                    },
                    expires_after: expiresAfter.toISOString(),
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!createExportResponse.ok) {
                const errorText = await createExportResponse.text();
                
                // If we get a timeout, try to find the export that might have been created
                if (createExportResponse.status === 504 || errorText.includes('504') || errorText.includes('Gateway Time-out')) {
                    if (!silent) {
                        console.log(`   ⚠️  Export creation timed out, checking for existing export...`);
                    }
                    exportId = await findExistingExport(sessionId, {
                        apiKey,
                        projectId,
                        host,
                    });
                    
                    if (exportId) {
                        if (!silent) {
                            console.log(`   ✅ Found export created before timeout: ${exportId}`);
                        }
                    } else {
                        throw new Error(`Failed to create export: Gateway timeout and no existing export found. Please try again.`);
                    }
                } else {
                    if (createExportResponse.status === 401) {
                        throw new Error('PostHog API key is invalid or expired.');
                    }
                    throw new Error(`Failed to create export: ${errorText}`);
                }
            } else {
                const exportData = await createExportResponse.json();
                exportId = exportData.id;

                if (!exportId) {
                    throw new Error('Export creation did not return an export ID');
                }

                if (!silent) {
                    console.log(`   Created export: ${exportId}`);
                }
            }
        } catch (error: any) {
            // Handle abort/timeout
            if (error.name === 'AbortError' || error.message?.includes('timeout')) {
                if (!silent) {
                    console.log(`   ⚠️  Export creation timed out, checking for existing export...`);
                }
                exportId = await findExistingExport(sessionId, {
                    apiKey,
                    projectId,
                    host,
                });
                
                if (exportId) {
                    if (!silent) {
                        console.log(`   ✅ Found export created before timeout: ${exportId}`);
                    }
                } else {
                    throw new Error(`Failed to create export: Request timed out and no existing export found. Please try again.`);
                }
            } else {
                throw error;
            }
        }
    }

    if (!exportId) {
        throw new Error('No export ID available');
    }

    if (!silent) {
        console.log(`   Polling for completion...`);
    }

    // Step 2: Poll for completion
    const pollUrl = `${host}/api/projects/${projectId}/exports/${exportId}/`;
    const exportsListUrl = `${host}/api/projects/${projectId}/exports/`;
    const maxWaitTime = 5 * 60 * 1000; // 5 minutes
    const pollInterval = 2500; // 2.5 seconds
    const startTime = Date.now();
    let hasContent = false;
    let consecutiveFailures = 0;

    while (!hasContent && (Date.now() - startTime) < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        let pollData: any = null;
        let pollSuccess = false;

        // Try individual export endpoint first
        try {
            const pollResponse = await fetch(pollUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
            });

            if (pollResponse.ok) {
                pollData = await pollResponse.json();
                pollSuccess = true;
                consecutiveFailures = 0;
            } else {
                consecutiveFailures++;
            }
        } catch (error) {
            consecutiveFailures++;
        }

        // If individual endpoint fails, try the list endpoint as fallback
        if (!pollSuccess && consecutiveFailures >= 2) {
            try {
                const listResponse = await fetch(exportsListUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (listResponse.ok) {
                    const listData = await listResponse.json();
                    const exports = Array.isArray(listData) ? listData : (listData.results || listData.data || []);
                    
                    // Find our export in the list
                    const foundExport = exports.find((exp: any) => exp.id === exportId);
                    if (foundExport) {
                        pollData = foundExport;
                        pollSuccess = true;
                        consecutiveFailures = 0;
                    }
                }
            } catch (error) {
                // Continue with next poll attempt
            }
        }

        if (!pollSuccess) {
            if (!silent) {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                process.stdout.write(`\r   Waiting for export... ${elapsed}s elapsed (polling...)`);
            }
            continue;
        }

        // Check for errors
        if (pollData.exception) {
            throw new Error(`Export failed: ${pollData.exception}`);
        }

        hasContent = pollData.has_content === true;

        if (!hasContent && !silent) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            process.stdout.write(`\r   Waiting for export... ${elapsed}s elapsed`);
        }
    }

    if (!silent) {
        process.stdout.write('\r'); // Clear the progress line
    }

    if (!hasContent) {
        throw new Error('Export timed out after 5 minutes');
    }

    if (!silent) {
        console.log(`   Export ready!`);
    }

    // Step 3: Download the MP4
    const downloadUrl = `${host}/api/projects/${projectId}/exports/${exportId}/content/`;
    const downloadResponse = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        },
    });

    if (!downloadResponse.ok) {
        const errorText = await downloadResponse.text();
        throw new Error(`Failed to download export: ${errorText}`);
    }

    // Save the binary MP4 file
    const arrayBuffer = await downloadResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(outputPath, buffer);

    if (!silent) {
        const fileSize = fs.statSync(outputPath).size;
        console.log(`✅ Downloaded MP4: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   💾 Video saved to: ${outputPath}`);
    }

    return outputPath;
}

/**
 * Fetch console logs for a session using PostHog Query API
 */
export async function getConsoleLogs(
    sessionId: string,
    options: {
        apiKey: string;
        projectId: string;
        host?: string;
        silent?: boolean; // If true, don't log to console
    }
): Promise<ConsoleLog[]> {
    const {
        apiKey,
        projectId,
        host = 'https://us.posthog.com',
        silent = false,
    } = options;

    if (!silent) {
        console.log(`\n📋 Fetching console logs for session ${sessionId}...`);
    }

    const queryUrl = `${host}/api/projects/${projectId}/query/`;
    
    const hogqlQuery = `
        SELECT 
          timestamp,
          level,
          message
        FROM log_entries 
        WHERE log_source = 'session_replay'
          AND log_source_id = '${sessionId}'
        ORDER BY timestamp ASC
        LIMIT 10000
    `.trim();

    try {
        const response = await fetch(queryUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: {
                    kind: 'HogQLQuery',
                    query: hogqlQuery,
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 401) {
                throw new Error('PostHog API key is invalid or expired.');
            }
            throw new Error(`Failed to fetch console logs: ${errorText}`);
        }

        const data = await response.json();
        const results = data.results || [];
        const columns = data.columns || ['timestamp', 'level', 'message'];

        // Map results to objects
        const consoleLogs: ConsoleLog[] = results.map((row: any[]) => {
            const log: any = {};
            columns.forEach((col: string, index: number) => {
                log[col] = row[index];
            });
            return log as ConsoleLog;
        });

        if (!silent) {
            console.log(`✅ Found ${consoleLogs.length} console log entries`);
        }
        return consoleLogs;
    } catch (error: any) {
        if (error.message.includes('Failed to fetch')) {
            throw error;
        }
        throw new Error(`Failed to fetch console logs: ${error.message}`);
    }
}

/**
 * Analyze video with Gemini
 */
export async function analyzeWithGemini(
    videoPath: string,
    options: {
        apiKey: string;
        sessionInfo?: SessionRecording;
        consoleLogs?: ConsoleLog[];
        silent?: boolean; // If true, don't log to console
    }
): Promise<string> {
    const { apiKey, sessionInfo, consoleLogs = [], silent = false } = options;

    if (!silent) {
        console.log(`\n🤖 Step 4: Analyzing video with Gemini...`);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // Read video file as base64
    const videoBuffer = fs.readFileSync(videoPath);
    const videoBase64 = videoBuffer.toString('base64');

    // Prepare console logs and network requests text for the prompt
    // Prioritize errors and warnings, but include all for comprehensive analysis
    let consoleLogsText = '';
    if (consoleLogs.length > 0) {
        // Sort to put errors/warnings first, but include all
        const sortedLogs = [...consoleLogs].sort((a, b) => {
            const priority = { error: 0, warn: 1, info: 2, log: 3, debug: 4 };
            return (priority[a.level as keyof typeof priority] ?? 99) - (priority[b.level as keyof typeof priority] ?? 99);
        });
        
        // Truncate very long messages to prevent token bloat, but keep enough context
        const formattedLogs = sortedLogs.map((log) => {
            const maxLength = 500;
            const message = log.message.length > maxLength 
                ? log.message.substring(0, maxLength) + '...[truncated]'
                : log.message;
            return `[${log.timestamp}] [${log.level.toUpperCase()}] ${message}`;
        });
        
        consoleLogsText = `\n\n## CONSOLE LOGS (${consoleLogs.length} total entries, sorted by severity: errors/warnings first):
${formattedLogs.join('\n')}`;
    }

    // Prepare prompt
    const prompt = `You are a Software Bug Triage Specialist. Your job is to quickly gather context necessary to prep an engineer when a client emails stating there is an issue.

A client has reported a problem with the application. You have access to:
1. A session recording video showing the user's interaction
2. Console logs from the browser session
3. Network requests made during the session

Your task is to analyze these sources and create a concise, actionable bug report that will help an engineer quickly understand and fix the issue.

**CRITICAL: You MUST cite the source for EVERY claim you make. For each issue you identify, you must specify which source provides the evidence:**
- **CONSOLE**: Reference specific console log entries by timestamp and level
- **SESSION**: Reference specific timestamps in the video where the issue is visible

Format citations like: [CONSOLE: 2025-01-19T10:15:23.456Z error] or [NETWORK: 2025-01-19T10:15:24.789Z GET /api/users] or [SESSION: 00:01:23]

Provide a structured bug report with the following sections:
1. **Summary**: Brief one-sentence description of the issue (what the client is experiencing)

2. **Technical Errors & Bugs**: Any JavaScript errors, API failures, broken functionality, or unexpected application crashes. Include specific error messages. MUST cite console logs that show the error.

3. **UI/UX Issues**: Broken interactions, unresponsive buttons/links, visual glitches, layout issues, or elements that don't work as expected. MUST cite the video timestamp where the issue occurs.

4. **Performance Problems**: Slow loading times, laggy interactions, unresponsive UI, or noticeable performance degradation. MUST cite network request timings or video timestamps showing the delay.

5. **Reproduction Steps**: For each bug identified, provide clear, step-by-step instructions to reproduce the problem, including timestamps from the session. MUST reference the source that shows the issue.

6. **Root Cause Indicators**: Technical evidence that points to the likely root cause (error messages, failed API calls, network timeouts, etc.). MUST include citations.

7. **Recommended Next Steps**: What the engineer should investigate first (specific files, API endpoints, error codes, etc.).

Focus on ACTIONABLE, ENGINEERING-FOCUSED bug reports. This is not for product management - focus on technical issues that need to be fixed. Avoid product feature recommendations or general UX improvements unless they're clearly bugs.

${sessionInfo ? `Session Info:
- Duration: ${sessionInfo.duration}s
- Events: ${sessionInfo.eventsCount}
- Start Time: ${sessionInfo.startTime}
` : ''}${consoleLogsText}

Remember: EVERY claim must include a citation indicating the source (CONSOLE, NETWORK, or SESSION) and the specific timestamp or identifier.`;

    try {
        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: 'video/mp4',
                    data: videoBase64,
                },
            },
            prompt,
        ]);

        const response = result.response;
        const analysis = response.text();

        if (!silent) {
            console.log(`✅ Analysis complete!`);
        }
        return analysis;
    } catch (error: any) {
        throw new Error(`Failed to analyze video with Gemini: ${error.message}`);
    }
}

/**
 * Main analysis function - analyzes a PostHog session recording with Gemini
 */
export async function analyzeSession(options: AnalyzeSessionOptions): Promise<AnalyzeSessionResult> {
    const {
        posthogApiKey,
        projectId,
        googleApiKey,
        posthogHost = 'https://us.posthog.com',
        userEmail,
        sessionId,
        outputDir,
        limit = 1,
        dateFrom = '-7d',
        dateTo = 'now',
    } = options;

    // Validate inputs
    if (!sessionId && !userEmail) {
        throw new Error('Either userEmail or sessionId must be provided');
    }

    // Setup output directory
    const defaultOutputDir = outputDir || path.join(process.cwd(), 'session_output');
    if (!fs.existsSync(defaultOutputDir)) {
        fs.mkdirSync(defaultOutputDir, { recursive: true });
    }

    // Step 1: Get session (either by ID or most recent by email)
    let session: SessionRecording | null;
    
    if (sessionId) {
        // Get session directly by ID
        session = await getSessionById(sessionId, {
            apiKey: posthogApiKey,
            projectId,
            host: posthogHost,
            silent: true, // Don't log in programmatic use
        });
    } else if (userEmail) {
        // Get most recent session by email
        session = await getFirstSession(userEmail, {
            apiKey: posthogApiKey,
            projectId,
            host: posthogHost,
            limit,
            dateFrom,
            dateTo,
            silent: true, // Don't log in programmatic use
        });
    } else {
        throw new Error('Either userEmail or sessionId must be provided');
    }

    if (!session) {
        throw new Error('No session found');
    }

    // Create a unique folder for this session run: <timestamp>-<sessionId>
    const timestamp = Date.now();
    const sessionFolder = path.join(defaultOutputDir, `${timestamp}-${session.id}`);
    if (!fs.existsSync(sessionFolder)) {
        fs.mkdirSync(sessionFolder, { recursive: true });
    }

    // Step 2: Fetch console logs
    let consoleLogs: ConsoleLog[] = [];
    let consoleLogsPath: string | null = null;
    
    // Fetch and save console logs
    try {
        consoleLogs = await getConsoleLogs(session.id, {
            apiKey: posthogApiKey,
            projectId,
            host: posthogHost,
            silent: true, // Don't log in programmatic use
        });
        
        consoleLogsPath = path.join(sessionFolder, `console-logs_${session.id}.json`);
        fs.writeFileSync(consoleLogsPath, JSON.stringify(consoleLogs, null, 2));
    } catch (error: any) {
        // Console logs are optional, continue if they fail
    }

    // Step 3: Export session as MP4
    const videoPath = path.join(sessionFolder, `session_${session.id}.mp4`);
    const duration = session.duration || 60; // Default to 60 seconds if duration is not available
    await exportSessionReplay(session.id, duration, {
        apiKey: posthogApiKey,
        projectId,
        host: posthogHost,
        outputPath: videoPath,
        silent: true, // Don't log in programmatic use
    });

    // Step 4: Analyze with Gemini
    const analysis = await analyzeWithGemini(videoPath, {
        apiKey: googleApiKey,
        sessionInfo: session,
        consoleLogs: consoleLogs,
        silent: true, // Don't log in programmatic use
    });

    // Save analysis to file
    const analysisPath = path.join(sessionFolder, `analysis_${session.id}.txt`);
    fs.writeFileSync(analysisPath, analysis);

    return {
        analysis,
        session,
        sessionUrl: session.sessionUrl,
        videoPath,
        analysisPath,
        consoleLogsPath: consoleLogsPath || undefined,
    };
}

