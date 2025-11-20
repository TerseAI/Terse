export const DEFAULT_USER_EMAIL = 'thomas@useterse.ai';
// Mock email templates - CRM Sales Pipeline progression
export const MOCK_CRM_SALES_PIPELINE_EMAILS = {
    'new-lead': {
        id: 'msg_001',
        threadId: 'thread_001',
        subject: 'Re: Demo Follow-up - Moving Forward with Enterprise Plan',
        from: 'jennifer.martinez@techstartup.io',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        internalDate: new Date().getTime().toString(),
        messageId: '<lead001@techstartup.io>',
        body: 'Would like to chat about your product. I am a potential customer.',
        snippet: 'Would like to chat about your product. I am a potential customer.',
        labelIds: ['INBOX']
    },
    'meeting-scheduled': {
        id: 'msg_002',
        threadId: 'thread_001',
        subject: 'Re: Looking for AI channel solutions for our team',
        from: 'jennifer.martinez@techstartup.io',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        internalDate: new Date().getTime().toString(),
        messageId: '<meeting002@techstartup.io>',
        body: 'Hi,\n\nThanks for getting back to me so quickly! I\'d love to jump on a call to discuss this further.\n\nI\'ve added a 45-minute meeting to both our calendars for Tuesday at 2pm EST. I\'ll have our Head of Product, Alex Chen, join as well since he\'ll be working closely with whatever solution we implement.\n\nBefore the call, it would be helpful to know:\n- Your typical engagement timeline\n- Case studies or examples of similar work\n- Your team structure and who we\'d be working with\n\nLooking forward to the conversation!\n\nBest,\nJennifer Martinez\nCOO, TechStartup Inc.',
        snippet: 'Thanks for getting back to me so quickly! I\'d love to jump on a call...',
        labelIds: ['INBOX']
    },
    'qualified-opportunity': {
        id: 'msg_003',
        threadId: 'thread_001',
        subject: 'Re: Looking for AI channel solutions - Next steps',
        from: 'jennifer.martinez@techstartup.io',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        internalDate: new Date().getTime().toString(),
        messageId: '<qualified003@techstartup.io>',
        body: 'Hi,\n\nGreat call yesterday! Alex and I are both really excited about working together. Your approach to channel aligns perfectly with what we\'re trying to achieve.\n\nWe\'ve discussed internally and we\'d like to move forward with a pilot project. Specifically:\n\n1. Phase 1: Automate our customer onboarding workflow (weeks 1-3)\n2. Phase 2: Build Notion-Slack integration for our sales team (weeks 4-6)\n3. Phase 3: Implement AI-powered email routing for support (weeks 7-9)\n\nBudget-wise, we\'re comfortable with the $8K/month retainer you mentioned. Can you send over:\n- A formal proposal with timeline and deliverables\n- Your standard contract terms\n- References from 2-3 similar clients\n\nWe\'re hoping to have everything signed by end of next week so we can start on the 1st.\n\nBest,\nJennifer Martinez\nCOO, TechStartup Inc.',
        snippet: 'Great call yesterday! Alex and I are both really excited about working together...',
        labelIds: ['INBOX']
    },
    'negotiation': {
        id: 'msg_004',
        threadId: 'thread_001',
        subject: 'Re: Proposal Review - A few questions',
        from: 'jennifer.martinez@techstartup.io',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        internalDate: new Date().getTime().toString(),
        messageId: '<negotiation004@techstartup.io>',
        body: 'Hi,\n\nThanks for the detailed proposal! Our leadership team reviewed it over the weekend. We\'re really close to signing, but have a few items to discuss:\n\n1. Payment terms: Can we do monthly billing instead of quarterly? Our CFO prefers it for cash flow management.\n\n2. Scope adjustment: We\'d like to prioritize Phase 2 (Notion-Slack integration) over Phase 3, and potentially defer Phase 3 to month 2.\n\n3. Support SLA: Can you guarantee 24-hour response time for critical issues? We operate 24/7.\n\n4. IP/Ownership: The contract mentions joint ownership of custom code - can we get full ownership of any custom integrations built specifically for us?\n\nIf we can align on these points, we\'re ready to sign. The references you provided were excellent - we spoke to DataCorp and they had nothing but positive things to say.\n\nCan we hop on a quick call Thursday morning to finalize?\n\nBest,\nJennifer Martinez\nCOO, TechStartup Inc.',
        snippet: 'Thanks for the detailed proposal! Our leadership team reviewed it over the weekend...',
        labelIds: ['INBOX']
    },
    'closed-won': {
        id: 'msg_005',
        threadId: 'thread_001',
        subject: 'Contract signed! Ready to kick off 🎉',
        from: 'jennifer.martinez@techstartup.io',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        internalDate: new Date().getTime().toString(),
        messageId: '<won005@techstartup.io>',
        body: 'Hi,\n\nExcellent news - I just signed and returned the contract! Our team is really excited to get started.\n\nOur first invoice payment will process this Friday. In the meantime, here\'s what we\'ve prepared on our end:\n\n- Alex Chen will be your main point of contact for technical implementation\n- We\'ve created a shared Notion workspace and added you as a collaborator\n- Our engineering team is ready to provide API access and documentation\n- We\'ve blocked off time for the kickoff meeting on Monday at 10am EST\n\nI\'ll send calendar invites for the kickoff and our weekly check-ins. Also attaching our current process docs so you can familiarize yourself with our workflows before Monday.\n\nThis is going to be a game-changer for our operations. Really looking forward to the partnership!\n\nBest,\nJennifer Martinez\nCOO, TechStartup Inc.\n\nP.S. - Our CEO wants to say hi on the kickoff call. She\'s pumped about this! 🚀',
        snippet: 'Excellent news - I just signed and returned the contract! Our team is really excited...',
        labelIds: ['INBOX']
    }
};

// Mock email templates - Architecture Discussions (Software Design Architecture)
export const MOCK_ARCHITECTURE_DISCUSSION_EMAILS = {
    'initial-proposal': {
        id: 'msg_arch_001',
        threadId: 'thread_arch_001',
        subject: 'Proposed Microservices Migration Architecture',
        from: 'sarah.chen@engineering.techstartup.io',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        internalDate: new Date().getTime().toString(),
        messageId: '<arch001@techstartup.io>',
        body: 'Hi team,\n\nI\'ve been analyzing our current monolithic architecture and believe we need to start planning a migration to microservices. Our current system is becoming a bottleneck as we scale.\n\nI\'ve drafted an initial architecture proposal that outlines:\n- Service boundaries based on domain-driven design\n- API gateway pattern for routing\n- Event-driven communication between services\n- Database per service pattern\n- Proposed tech stack: Kubernetes, Docker, gRPC for inter-service communication\n\nKey benefits:\n- Independent scaling of services\n- Technology diversity (we can use the right tool for each service)\n- Better fault isolation\n- Faster deployment cycles\n\nI\'d like to schedule a design review meeting next week to discuss this in detail. Please review the attached architecture diagram and share your thoughts.\n\nBest,\nSarah Chen\nSenior Software Architect',
        snippet: 'I\'ve been analyzing our current monolithic architecture and believe we need to start planning...',
        labelIds: ['INBOX']
    },
    'design-pattern-discussion': {
        id: 'msg_arch_002',
        threadId: 'thread_arch_002',
        subject: 'Re: Choosing Between CQRS and Traditional CRUD Pattern',
        from: 'michael.rodriguez@engineering.techstartup.io',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        internalDate: new Date().getTime().toString(),
        messageId: '<arch002@techstartup.io>',
        body: 'Hi,\n\nI\'ve been thinking about our read-heavy user analytics service. We\'re seeing performance issues with complex queries on our main database.\n\nI\'m proposing we implement CQRS (Command Query Responsibility Segregation) for this service:\n\n1. **Command Side**: Write operations go to the primary database (PostgreSQL)\n2. **Query Side**: Read operations hit a denormalized read model (Elasticsearch or MongoDB)\n3. **Event Sourcing**: Use events to keep read models in sync\n\nThis would give us:\n- Better read performance (optimized read models)\n- Ability to scale reads independently\n- Historical data tracking through event log\n\nAlternative is to optimize the current CRUD approach with better indexing and read replicas. However, given our query complexity, I think CQRS is the right long-term solution.\n\nWhat are your thoughts? Should we schedule a technical deep-dive?\n\nBest,\nMichael Rodriguez\nLead Engineer, Analytics Team',
        snippet: 'I\'ve been thinking about our read-heavy user analytics service. We\'re seeing performance issues...',
        labelIds: ['INBOX']
    },
    'scalability-concerns': {
        id: 'msg_arch_003',
        threadId: 'thread_arch_003',
        subject: 'Re: Database Sharding Strategy - Need Architecture Input',
        from: 'priya.sharma@engineering.techstartup.io',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        internalDate: new Date().getTime().toString(),
        messageId: '<arch003@techstartup.io>',
        body: 'Hi team,\n\nOur user database is approaching 50M records and we\'re starting to see performance degradation. I\'ve been researching sharding strategies and need input on the best approach.\n\n**Option 1: Horizontal Sharding by User ID**\n- Hash user_id to determine shard\n- Pros: Even distribution, simple routing\n- Cons: Cross-shard queries become complex\n\n**Option 2: Vertical Sharding by Feature**\n- Separate shards for users, orders, analytics\n- Pros: Better for feature-specific scaling\n- Cons: More complex joins across shards\n\n**Option 3: Geographic Sharding**\n- Shard by user location/region\n- Pros: Better latency for users\n- Cons: Uneven distribution (some regions much larger)\n\nI\'m leaning towards Option 1 with a sharding proxy layer (like Vitess or ProxySQL). However, I want to make sure we\'re thinking about:\n- How to handle cross-shard transactions\n- Backup and disaster recovery strategy\n- Rebalancing strategy as data grows\n\nCan we schedule an architecture review this week?\n\nBest,\nPriya Sharma\nSenior Database Engineer',
        snippet: 'Our user database is approaching 50M records and we\'re starting to see performance degradation...',
        labelIds: ['INBOX']
    },
    'refactoring-discussion': {
        id: 'msg_arch_004',
        threadId: 'thread_arch_004',
        subject: 'Re: Refactoring Legacy Payment Service - Architecture Proposal',
        from: 'david.kim@engineering.techstartup.io',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        internalDate: new Date().getTime().toString(),
        messageId: '<arch004@techstartup.io>',
        body: 'Hi,\n\nOur payment service has become a maintenance nightmare. It\'s a 5-year-old codebase with tight coupling, no tests, and handles multiple payment providers in a single service.\n\nI\'m proposing a strategic refactor following these principles:\n\n**Phase 1: Extract Payment Provider Adapters**\n- Create abstraction layer for Stripe, PayPal, Square\n- Implement adapter pattern for each provider\n- This allows us to add new providers without touching core logic\n\n**Phase 2: Split into Core Services**\n- Payment Processing Service (handles transactions)\n- Payment Provider Service (handles provider-specific logic)\n- Payment History Service (handles reporting/analytics)\n\n**Phase 3: Implement Circuit Breaker Pattern**\n- Add resilience for provider failures\n- Fallback mechanisms\n- Better error handling\n\n**Tech Stack Changes:**\n- Move from Java to Go (better for high-throughput payment processing)\n- Add Redis for caching payment status\n- Implement idempotency keys for all operations\n- Add comprehensive logging and monitoring\n\nI\'ve created a detailed migration plan with rollback strategies. The key is doing this incrementally without disrupting current operations.\n\nThoughts? Should I present this at the next architecture review?\n\nBest,\nDavid Kim\nEngineering Lead, Payments Team',
        snippet: 'Our payment service has become a maintenance nightmare. It\'s a 5-year-old codebase with tight coupling...',
        labelIds: ['INBOX']
    },
    'architecture-review': {
        id: 'msg_arch_005',
        threadId: 'thread_arch_005',
        subject: 'Re: Architecture Review - Proposed Event-Driven Architecture',
        from: 'emma.wilson@engineering.techstartup.io',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        internalDate: new Date().getTime().toString(),
        messageId: '<arch005@techstartup.io>',
        body: 'Hi team,\n\nFollowing up on our architecture review meeting. We\'ve decided to move forward with the event-driven architecture proposal, but with some modifications:\n\n**Approved Architecture:**\n- Apache Kafka as our event streaming platform\n- Event sourcing for critical business events\n- CQRS pattern for read-heavy services\n- Saga pattern for distributed transactions\n\n**Key Decisions Made:**\n1. We\'ll use Avro schema for event serialization (better compatibility than JSON)\n2. Event retention: 90 days for hot storage, archive to S3 for longer\n3. Consumer groups organized by service boundaries\n4. Dead letter queues for failed event processing\n\n**Next Steps:**\n- Set up Kafka cluster in staging environment\n- Create event schema registry\n- Migrate order service first as a pilot (lowest risk)\n- Establish monitoring and alerting for event lag\n- Document event contracts and versioning strategy\n\n**Concerns to Address:**\n- Event ordering guarantees (we decided on per-partition ordering)\n- Exactly-once delivery semantics (using Kafka transactions)\n- Handling schema evolution (backward compatibility strategy)\n\nI\'ll be creating detailed design docs and implementation plan. Target kickoff: 2 weeks from now.\n\nThanks everyone for the productive discussion!\n\nBest,\nEmma Wilson\nPrincipal Architect',
        snippet: 'Following up on our architecture review meeting. We\'ve decided to move forward with the event-driven architecture...',
        labelIds: ['INBOX']
    }
};

