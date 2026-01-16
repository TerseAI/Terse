import { Tool } from "@openai/agents";
import { ChannelOutput, PrismaTransaction, User, UserSlackIntegration } from "../../types/prisma";
import { automation_slack_configs } from "@prisma/client";
import { Session } from "../../server";
import { Output, ToolboxEntry } from "../abstract/Output";
import { db } from "../../prismaClient";
import { OutputConfigType } from "@prisma/client";
import { SlackOutputConfig } from "../../shared/Configs";
import { slackSendMessageTool } from "./tools/sendMessage";
import { IntegrationType } from "../../shared/Integrations";

export interface SlackChannelSession extends Session {
    slackIntegration: UserSlackIntegration; // User's Slack integration record
    slackConfig: automation_slack_configs; // Configuration for the Slack channel/DM
}

export class SlackOutput extends Output<SlackChannelSession, SlackOutputConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: slackSendMessageTool as Tool, isReadOnly: false, integration: IntegrationType.SLACK },
        ];
        super(OutputConfigType.SLACK_CHANNEL, toolbox);
    }

    async createSessionFromConfig(
        integrationId: string,
        channelOutputConfig: ChannelOutput,
        user: User
    ): Promise<SlackChannelSession> {
        // For Slack, integrationId is the user_slack_integrations.id
        const userSlackIntegration = await db().user_slack_integrations.findFirst({
            where: { 
                id: integrationId,
                user_id: user.id,
            },
            include: {
                slack_integration: true,
            },
        });

        if (!userSlackIntegration) {
            throw new Error(`Slack integration ${integrationId} not found for user`);
        }

        const slackConfigRecord = await db().automation_slack_configs.findFirst({
            where: { automation_output_id: channelOutputConfig.id }
        });

        if (!slackConfigRecord) {
            throw new Error(`Slack config for automation output ${channelOutputConfig.id} not found`);
        }

        return { 
            slackIntegration: userSlackIntegration, 
            slackConfig: slackConfigRecord, 
            user: user, 
            isUserInitiated: true 
        };
    }

    async validateConfig(output: SlackOutputConfig, _userId: string): Promise<void> {
        if (!output.channelId) {
            throw new Error('Invalid output config for slack_output: missing channelId');
        }
    }

    async addOutputToChannel(tx: PrismaTransaction, channelOutputId: string, output: SlackOutputConfig): Promise<void> {
        await tx.automation_slack_configs.create({
            data: {
                automation_output_id: channelOutputId,
                channel_id: output.channelId || null,
                channel_name: output.channelName || null,
                listen_to_user_dms: false, // Not applicable for outputs
                user_ids: [], // Not applicable for outputs
            },
        });
    }

    getSystemInstructions(_session: SlackChannelSession): string {
        return SLACK_OUTPUT_INSTRUCTIONS;
    }
}

const SLACK_OUTPUT_INSTRUCTIONS = `
## SLACK OUTPUT

You have access to post messages to Slack. Use the slack_send_message tool to communicate results, updates, or reports.

The user will not be able to respond to the message you send. So never include a call to action in the message. No prompts, no questions.

### Message Types

You can send messages in two ways:

1. **Plain Text Messages**: Simple text with mrkdwn formatting
   - Use for: Simple notifications, short updates, basic information
   - Format: Just provide the \`message\` parameter

2. **Block Kit Messages**: Rich, interactive messages with structured layouts
   - Use for: Reports with metrics, messages needing buttons (e.g., dashboard links), structured data presentation
   - Format: Provide both \`message\` (fallback text) and \`blocks\` (JSON array string)

### Plain Text Guidelines:
1. **Be concise**: Keep messages focused and actionable
2. **Use formatting**: Leverage Slack's mrkdwn for readability
   - *bold* for emphasis
   - _italic_ for secondary emphasis
   - \`code\` for technical terms
   - \`\`\`code block\`\`\` for multi-line code
   - <url|text> for links
   - Use bullet points (•) for lists
3. **Structure information**: Use clear sections and headers for longer messages
4. **Include context**: Reference relevant details from the automation trigger
5. **Add links**: When referencing external resources, include clickable links

### Block Kit Guidelines:

Block Kit allows you to create rich, interactive messages with:
- **Buttons**: Interactive buttons that open URLs (e.g., dashboards, reports) or trigger actions
- **Structured layouts**: Section blocks with fields for organized information display
- **Visual elements**: Dividers, headers, images for better presentation
- **Context blocks**: Small metadata text at the bottom

#### When to Use Block Kit:
- ✅ When you need interactive buttons (e.g., "Open Dashboard", "View Report")
- ✅ When presenting structured data (metrics, reports with multiple fields)
- ✅ When you want better visual organization than plain text
- ✅ When providing quick actions to users (opening dashboards, viewing details)
- ✅ For reports with multiple sections or key-value pairs

#### When to Use Plain Text:
- ✅ Simple notifications or updates
- ✅ Short messages that don't need structure
- ✅ When you don't need interactive elements
- ✅ Quick status updates

### Block Kit Examples:

#### Example 1: Dashboard Button
Use this when you want to provide a button that opens a dashboard or external link:

\`\`\`json
[
  {
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": "*Report Generated*\nYour analytics report is ready. Click below to view the dashboard."
    }
  },
  {
    "type": "actions",
    "elements": [
      {
        "type": "button",
        "text": {
          "type": "plain_text",
          "text": "Open Dashboard",
          "emoji": true
        },
        "url": "https://dashboard.example.com/report/123",
        "action_id": "open_dashboard"
      }
    ]
  }
]
\`\`\`

#### Example 2: Structured Report with Metrics
Use this for reports with multiple metrics or key-value pairs:

\`\`\`json
[
  {
    "type": "header",
    "text": {
      "type": "plain_text",
      "text": "📊 Analytics Summary"
    }
  },
  {
    "type": "section",
    "fields": [
      {
        "type": "mrkdwn",
        "text": "*Total Users:*\n1,234"
      },
      {
        "type": "mrkdwn",
        "text": "*Active Today:*\n567"
      },
      {
        "type": "mrkdwn",
        "text": "*New Signups:*\n89"
      },
      {
        "type": "mrkdwn",
        "text": "*Growth Rate:*\n+12.5%"
      }
    ]
  },
  {
    "type": "divider"
  },
  {
    "type": "actions",
    "elements": [
      {
        "type": "button",
        "text": {
          "type": "plain_text",
          "text": "View Full Dashboard"
        },
        "url": "https://analytics.example.com",
        "action_id": "view_dashboard"
      },
      {
        "type": "button",
        "text": {
          "type": "plain_text",
          "text": "Export Report"
        },
        "url": "https://analytics.example.com/export",
        "action_id": "export_report"
      }
    ]
  },
  {
    "type": "context",
    "elements": [
      {
        "type": "mrkdwn",
        "text": "Report generated at 2024-01-15 10:30 AM"
      }
    ]
  }
]
\`\`\`

#### Example 3: Section with Button Accessory
Use this for a compact layout with text and a button side-by-side:

\`\`\`json
[
  {
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": "*Deployment Complete*\nYour application has been successfully deployed to production."
    },
    "accessory": {
      "type": "button",
      "text": {
        "type": "plain_text",
        "text": "View Deployment"
      },
      "url": "https://deploy.example.com/deployments/456",
      "action_id": "view_deployment"
    }
  }
]
\`\`\`

#### Example 4: Multiple Action Buttons
Use this when you need multiple action options:

\`\`\`json
[
  {
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": "*Issue Detected*\nA potential issue has been identified in the system."
    }
  },
  {
    "type": "actions",
    "elements": [
      {
        "type": "button",
        "text": {
          "type": "plain_text",
          "text": "View Details"
        },
        "url": "https://monitoring.example.com/issues/789",
        "action_id": "view_details"
      },
      {
        "type": "button",
        "text": {
          "type": "plain_text",
          "text": "Open Logs"
        },
        "url": "https://logs.example.com/issue/789",
        "action_id": "view_logs"
      }
    ]
  }
]
\`\`\`

### Block Kit Block Types Reference:

- **section**: Text block with optional fields or accessory (button)
- **header**: Large text header (plain text only, max 150 chars)
- **divider**: Visual separator line
- **context**: Small text for metadata (bottom of message)
- **actions**: Container for interactive elements (buttons, selects)
- **image**: Display an image

### Button Element Properties:

- **type**: Always "button"
- **text**: Button label (plain_text object, max 75 chars)
- **url**: External URL to open when clicked (for dashboard links)
- **action_id**: Unique identifier (required if no URL, max 255 chars)
- **style**: Optional - "primary" (green) or "danger" (red)
- **value**: Optional data sent in action payload (max 2000 chars)

### Best Practices:

1. **Always provide fallback text**: The \`message\` parameter is used as fallback if Block Kit fails
2. **Keep blocks organized**: Use dividers and sections to organize content
3. **Limit buttons**: Maximum 25 elements per actions block
4. **Use URLs for external links**: Buttons with \`url\` open external links (perfect for dashboards)
5. **Be concise**: Button text should be clear and brief (max 75 chars)
6. **Use context blocks**: Add timestamps or metadata at the bottom
7. **Test structure**: Ensure JSON is valid before sending

### Example Plain Text Message:
\`\`\`
*Summary Title*

Key findings or updates here.

• Point 1
• Point 2
• Point 3

<https://example.com|View Details>
\`\`\`
`.trim();
