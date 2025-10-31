// Usage: node backend/scripts/seedRunHistory.js <automationId>
// Inserts sample run history records and actions for the given automation.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  const automationId = process.argv[2];
  if (!automationId) {
    console.error('Please provide an automationId.\nExample: node backend/scripts/seedRunHistory.js auto_123');
    process.exit(1);
  }

  const samples = [
    {
      timestamp: daysAgo(0),
      trigger: { event: 'email received', integration: 'gmail', source: 'Gmail', title: 'Intro call follow-up', subheader: 'recruiter@company.com', url: 'https://mail.google.com/' },
      filtered: false,
      decision: { action: 'processed', reason: 'Matches criteria' },
      status: 'success',
      actions: [ { action: 'create database entry', integration: 'notion', target: 'Hiring DB', details: 'Created candidate record', url: 'https://notion.so/' } ],
    },
    {
      timestamp: daysAgo(1),
      trigger: { event: 'github push', integration: 'github', source: 'repo/name', title: 'Push to main', subheader: '12 files changed', url: 'https://github.com/' },
      filtered: false,
      decision: { action: 'processed', reason: 'Watched repository' },
      status: 'success',
      actions: [ { action: 'notify', integration: 'slack', target: '#engineering', details: 'Posted summary to Slack' } ],
    },
    {
      timestamp: daysAgo(2),
      trigger: { event: 'notion db change', integration: 'notion', source: 'Project Tasks', title: 'Task updated', subheader: 'Refactor module', url: 'https://notion.so/' },
      filtered: true,
      decision: { action: 'skipped', reason: 'Did not meet rules' },
      status: 'skipped',
      actions: [],
    },
    {
      timestamp: daysAgo(3),
      trigger: { event: 'linear issue created', integration: 'linear', source: 'ENG', title: 'Bug: crash on save', subheader: 'High priority', url: 'https://linear.app/' },
      filtered: false,
      decision: { action: 'processed', reason: 'Auto triage' },
      status: 'failed',
      actions: [ { action: 'create comment', integration: 'linear', target: 'ENG-123', details: 'Added triage comment' } ],
    },
  ];

  for (const s of samples) {
    const rec = await prisma.run_history_records.create({
      data: {
        automation_id: automationId,
        timestamp: s.timestamp,
        event: s.trigger.event,
        trigger_integration: s.trigger.integration,
        trigger_source: s.trigger.source,
        trigger_title: s.trigger.title,
        trigger_subheader: s.trigger.subheader,
        trigger_url: s.trigger.url,
        filtered: s.filtered,
        decision_action: s.decision.action,
        decision_reason: s.decision.reason,
        status: s.status,
      },
    });

    for (const a of s.actions) {
      await prisma.run_history_actions.create({
        data: {
          run_history_record_id: rec.id,
          action: a.action,
          integration: a.integration,
          target: a.target,
          details: a.details,
          url: a.url || null,
        },
      });
    }
  }

  console.log('Seeded run history for automation', automationId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});


