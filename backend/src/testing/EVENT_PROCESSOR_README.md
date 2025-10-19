# Event Processor Testing CLI

A simple CLI tool to test the `EventProcessor` with mock Gmail events without needing actual webhook integrations.

## Quick Start

```bash
cd backend
npx tsx src/testing/testEventProcessor.ts
```

Or add to package.json scripts:
```bash
npm run test:processor
```

## What it does

This testing tool allows you to:
- Test the EventProcessor with pre-defined mock emails
- Create custom emails on the fly
- See how the processor matches events to automations
- Test without needing Gmail OAuth or webhook setup
- Uses default test user (thomas.karatzas@mail.mcgill.ca)

## Mock Email Templates

The tool includes several pre-defined email templates:

1. **Newsletter** - Weekly tech newsletter from techcompany.com
2. **Customer Inquiry** - Question about product pricing
3. **Bug Report** - User reporting app crash on startup
4. **Sales Lead** - Potential enterprise customer inquiry

## How to Use

1. Run the CLI tool
2. The tool will automatically use/create the test user (thomas.karatzas@mail.mcgill.ca)
3. Select a pre-defined email template or create a custom one
4. The processor will:
   - Check for Gmail integration
   - Look for matching automations
   - Process the event
   - Show the result

## Creating Custom Emails

Select option 5 to create a custom email with:
- Custom subject
- Custom sender
- Custom recipient (defaults to test user)
- Custom body text

## Understanding Results

The processor will return:
- **Success/Failed** status
- **Message** explaining what happened
- **Automation** name (if matched)
- **Duration** of processing

Common results:
- ❌ "No Gmail integration found" - Need to set up Gmail integration for test user
- ❌ "No automation found" - Need to create an automation for test user
- ❌ "No output integration found" - Automation needs output configuration
- ✅ "Event processed successfully" - Everything worked!

## Next Steps

To make the processor actually work, you need:
1. Gmail integration for the test user
2. An active automation
3. Output integration (e.g., Notion) configured

This tool helps you verify the basic flow without needing to set up webhooks or send real emails.
