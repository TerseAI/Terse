# `@terse/durable`

Why did I build this?

Every durability platform is very heavy-weight and doesn't allow you to build on top of it (at least not easily). Over at Terse, we build durable flows that run in sandboxes. This created several issues when we were forced to use an OSS provider.

- The npm package was massive (200MB).
- they had their own control plane. So now we had our control plane, talk to their control plane in an isolated sandbox (you don't need a control plane her)