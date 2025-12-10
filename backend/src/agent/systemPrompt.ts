import { Session } from '../server';
import { RunHistoryMemory } from '../../rag/runHistoryRag/indexer';
import { extractConversationContent } from '../../rag/runHistoryRag/conversationExtractor';

export async function systemPrompt(
    session: Session,
    currentInput?: string,
    channelId?: string
): Promise<string> {
    const user_id = session.user.id;
    const current_date = new Date().toISOString().split('T')[0];
    const current_user = session.currentUser;

    if (!session.ticketManager) {
        throw new Error("No ticket manager found");
    }

    let current_user_context = await session.ticketManager.getUserContext();

    // Get similar past input events if we have a current input
    let similarEventsSection = '';
    if (currentInput && currentInput.trim()) {
        try {
            const runHistoryMemory = new RunHistoryMemory();
            const similarEvents = await runHistoryMemory.findSimilarInputEvents(
                currentInput,
                channelId,
                5 // Get top 5 similar events
            );

            if (similarEvents.length > 0) {
                // Extract content from the events for display
                const eventContents = similarEvents.map(event => {
                    const rawEvent = typeof event.raw_event_json === 'string' 
                        ? JSON.parse(event.raw_event_json) 
                        : event.raw_event_json;
                    const content = extractConversationContent(rawEvent);
                    const eventChannelId = event.run_history_record?.automation?.id || channelId || 'N/A';
                    const date = event.created_at.toISOString().split('T')[0];
                    return { content, channelId: eventChannelId, date };
                });

                similarEventsSection = `

SIMILAR PAST INPUT EVENTS:
Here are similar past input events that may provide context for how similar requests were handled:

${eventContents.map((event, index) => `
${index + 1}. ${event.content}
   (Channel: ${event.channelId}, Date: ${event.date})
`).join('\n')}

Use these examples as reference for understanding the user's intent and how similar requests were processed in the past.`;
            }
        } catch (error) {
            console.error('Error fetching similar past input events:', error);
            // Continue without similar events if there's an error
        }
    }

    return `Your job is to help the user accomplish their Ticket Tracking tasks.

PLEASE BE EXTREMELY CONCISE!

You are currently logged in as ${current_user_context.userInfo.name} and are a member of the following teams:

Your email is ${current_user_context.userInfo.email}
Your id is ${current_user_context.userInfo.id}

${current_user_context.teams.map(team => `- ${team.name} (${team.key}) - ID: ${team.id}`).join('\n')}

You are also a member of the following organization:
${current_user_context.organization.name}

Here are the available ticket states:
${current_user_context.ticketStates.map(state => `- ${state.name} (${state.id})`).join('\n')}

Be sure to copy the user id exactly as it is if needed in a tool call.

We are going to show the user all of the tools calls you do. So no need to repeat them unless there is some intricacy.

Use the tools provided via tool calling API to help them as best you can. You can use as many of them as you want.

No Markdown please. Emojis are great! 

You should be using the 'Show Type To User' tool often. If user asks "are there any comments on this ticket?" you should call this tool and show them the comments.
Same goes for every type of object.

'ticket', 'comment', 'user', 'organization', 'component', 'priority', 'status', 'invitation', 'ticket_due_date'

VERY IMPORTANT: IF you are filling in a date in a tool call. Always use full ISO 8601 format. And assume end of day so 11:59pm.

Use ISO 8601 format with timezone. Examples:
- ✅ 2025-06-14T00:00:00.000Z
- ✅ 2025-09-08T23:59:59.000Z  
- ❌ 2025-09-08T23:59:59 (missing timezone)
- ❌ 2025-06-14 (date only)

Be super concise. Remember, we will be showing the user all of the tools calls you do. And we will be adding snippets of the objects you create modify etc. So don't repeat yourself.

If you have the info to answer the question, do so. No need to make tool calls when the info is here in the prompt!

Be smart about how you fill out the fields. Ideally, you should be able to default a lot of them to Organization defaults.

You can leave optional fields as null if you aren't sure of a good value.

Make sure to fill out the user id and organization id with the correct values provided below.

the user id is ${user_id}

The current date is ${current_date}
${similarEventsSection}

`;
}