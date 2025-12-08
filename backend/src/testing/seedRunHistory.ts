import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export async function seedRunHistory(channelId: string): Promise<void> {
  const samples = [
    {
      timestamp: daysAgo(0),
      trigger: { event: 'email received', integration: 'gmail', source: 'Gmail', title: 'Intro call follow-up', subheader: 'recruiter@company.com', url: 'https://mail.google.com/' },
      filtered: false,
      decision: { action: 'processed', reason: 'Matches criteria' },
      status: 'success' as const,
      actions: [ { action: 'create database entry', integration: 'notion', target: 'Hiring DB', details: 'Created candidate record', url: 'https://notion.so/' } ],
    },
    {
      timestamp: daysAgo(1),
      trigger: { event: 'github push', integration: 'github', source: 'repo/name', title: 'Push to main', subheader: '12 files changed', url: 'https://github.com/' },
      filtered: false,
      decision: { action: 'processed', reason: 'Watched repository' },
      status: 'success' as const,
      actions: [ { action: 'notify', integration: 'slack', target: '#engineering', details: 'Posted summary to Slack' } ],
    },
    {
      timestamp: daysAgo(2),
      trigger: { event: 'notion db change', integration: 'notion', source: 'Project Tasks', title: 'Task updated', subheader: 'Refactor module', url: 'https://notion.so/' },
      filtered: true,
      decision: { action: 'skipped', reason: 'Did not meet rules' },
      status: 'skipped' as const,
      actions: [] as Array<any>,
    },
    {
      timestamp: daysAgo(3),
      trigger: { event: 'linear issue created', integration: 'linear', source: 'ENG', title: 'Bug: crash on save', subheader: 'High priority', url: 'https://linear.app/' },
      filtered: false,
      decision: { action: 'processed', reason: 'Auto triage' },
      status: 'failed' as const,
      actions: [ { action: 'create comment', integration: 'linear', target: 'ENG-123', details: 'Added triage comment' } ],
    },
  ];
  // Generate at least 50 records by cycling the sample templates across past days
  const totalRecords = 60; // keep a round number well above 50
  for (let i = 0; i < totalRecords; i++) {
    const template = samples[i % samples.length];
    const timestamp = daysAgo(i);
    const status = (i % 10 === 7) ? 'failed' : (template.status as any);
    const filtered = (i % 8 === 3) ? true : template.filtered;
    const decisionAction = filtered ? 'skipped' : (template.decision.action as any);
    const decisionReason = filtered ? 'Filtered by rule' : template.decision.reason;

    const rec = await prisma.run_history_records.create({
      data: {
        automation_id: channelId,
        timestamp,
        event: template.trigger.event,
        trigger_integration: template.trigger.integration as any,
        trigger_source: template.trigger.source,
        trigger_title: template.trigger.title,
        trigger_subheader: template.trigger.subheader,
        trigger_url: template.trigger.url,
        filtered,
        decision_action: decisionAction,
        decision_reason: decisionReason,
        status,
      },
    });

    const actions = filtered ? [] : template.actions;
    for (const a of actions) {
      await prisma.run_history_actions.create({
        data: {
          run_history_record_id: rec.id,
          action: a.action,
          integration: a.integration as any,
          target: a.target,
          details: a.details,
          url: a.url || null,
          type: a.type,
        },
      });
    }
  }
}

export async function clearRunHistory(channelId: string): Promise<void> {
  // Find all run history record ids for this channel
  const records: Array<{ id: string }> = await prisma.run_history_records.findMany({
    where: { automation_id: channelId },
    select: { id: true },
  });

  if (records.length === 0) return;

  const recordIds = records.map(r => r.id);

  // Delete actions first (FK)
  await prisma.run_history_actions.deleteMany({
    where: { run_history_record_id: { in: recordIds } },
  });

  // Then delete the records
  await prisma.run_history_records.deleteMany({
    where: { id: { in: recordIds } },
  });
}

async function main(): Promise<void> {
  const arg2 = process.argv[2];
  const arg3 = process.argv[3];
  if (!arg2) {
    console.error('Usage:\n  Seed:  node dist/testing/seedRunHistory.js <channelId>\n  Clear: node dist/testing/seedRunHistory.js --clear <channelId>');
    process.exit(1);
  }
  if (arg2 === '--clear') {
    const channelId = arg3;
    if (!channelId) {
      console.error('Please provide an channelId to clear.');
      process.exit(1);
    }
    await clearRunHistory(channelId);
    console.log('Cleared run history for channel', channelId);
    return;
  }

  const channelId = arg2;
  await seedRunHistory(channelId);
  console.log('Seeded run history for channel', channelId);
}

// Execute when run directly (compiled output path)
// eslint-disable-next-line @typescript-eslint/no-floating-promises
if (import.meta.url.endsWith('/testing/seedRunHistory.js') || import.meta.url.endsWith('/testing/seedRunHistory.ts')) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  }).finally(async () => {
    await prisma.$disconnect();
  });
}


