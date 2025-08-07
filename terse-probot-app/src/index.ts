import { Probot } from "probot";
import { VectraInterface, Commit, FileDiff } from "./vectraInterface.js";

// Add this temporarily to debug what URL is being constructed
console.log('Environment variables:', {
  WEBHOOK_PROXY_URL: process.env.WEBHOOK_PROXY_URL,
  NODE_ENV: process.env.NODE_ENV
});

export default (app: Probot) => {
  console.log("Probot app starting up...");

  app.onAny(async (context) => {
    console.log("🔔 Event received:", context.name);
  });

  app.on("issues.opened", async (context) => {
      console.log("📝 Issue opened:", context.payload.issue);
      const issueComment = context.issue({
        body: "Thanks for opening this issue!",
      });
      await context.octokit.issues.createComment(issueComment);
  });

  app.on("push", async (context) => {
    const { payload } = context;
    const github = context.octokit;

    console.log("🚀 Push event received!");

    let diffs: Commit[] = [];
    const installationId = context.payload.installation?.id || 0;

    // Get commit diffs
    for (const commit of payload.commits) {
      try {
        // Fetch commit details with diff
        const { data: commitData } = await github.rest.repos.getCommit({
          owner: payload.repository.owner.login,
          repo: payload.repository.name,
          ref: commit.id
        });

        console.log(`Commit: ${commit.id}`);
        console.log(`Message: ${commit.message}`);
        console.log(`Files changed: ${commitData.files?.length}`);

        let fileDiffs: FileDiff[] = [];
        // Inspect each changed file
        for (const file of commitData.files || []) {
          // The actual diff patch
          if (file.patch) {
            fileDiffs.push({
              filename: file.filename,
              diff: file.patch
            });
          }
        }

        diffs.push({
          sha: commit.id,
          name: commit.message,
          fileDiffs: fileDiffs
        });

      } catch (error) {
        console.error(`Error fetching commit ${commit.id}:`, error);
      }
    }

    try {
      await VectraInterface.githubUnifiedEvent(
        context.payload.sender?.login,
        installationId,
        context.payload.repository.name,
        'push',
        {
          branch: context.payload.ref,
          commits: diffs,
          repository: {
            name: context.payload.repository.name,
            owner: context.payload.repository.owner.login,
            defaultBranch: context.payload.repository.default_branch
          },
          sender: {
            login: context.payload.sender?.login,
            email: context.payload.sender?.email
          }
        }
      );
    } catch (error) {
      console.error('Error calling githubUnifiedEvent:', error);
    }
  });

  app.on("pull_request.synchronize", async (context) => {
    const pr = context.payload.pull_request as any;
    console.log("🔔 Pull request synchronized:", pr?.title);
    await handleUnifiedPullRequestEvent(context, 'pull_request.synchronize');
  });

  app.on("pull_request.opened", async (context) => {
    const pr = context.payload.pull_request as any;
    console.log("🔔 Pull request opened:", pr?.title);
    await handleUnifiedPullRequestEvent(context, 'pull_request.opened');
  });

  app.on("pull_request.closed", async (context) => {
    const pr = context.payload.pull_request as any;
    console.log("🔔 Pull request closed:", pr?.title);
    const eventType = pr?.merged ? 'pull_request.merged' : 'pull_request.closed';
    await handleUnifiedPullRequestEvent(context, eventType);
  });

  async function handleUnifiedPullRequestEvent(context: any, eventType: string) {
    const { payload } = context;
    const github = context.octokit;
    const installationId = context.payload.installation?.id || 0;

    let diffs: Commit[] = [];

    // Get commits in the PR
    try {
      const { data: commits } = await github.rest.pulls.listCommits({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        pull_number: payload.pull_request.number
      });

      // Get commit diffs
      for (const commit of commits) {
        try {
          const { data: commitData } = await github.rest.repos.getCommit({
            owner: payload.repository.owner.login,
            repo: payload.repository.name,
            ref: commit.sha
          });

          let fileDiffs: FileDiff[] = [];
          for (const file of commitData.files || []) {
            if (file.patch) {
              fileDiffs.push({
                filename: file.filename,
                diff: file.patch
              });
            }
          }

          diffs.push({
            sha: commit.sha,
            name: commit.commit.message,
            fileDiffs: fileDiffs
          });

        } catch (error) {
          console.error(`Error fetching commit ${commit.sha}:`, error);
        }
      }

      await VectraInterface.githubUnifiedEvent(
        payload.sender?.login,
        installationId,
        payload.repository.name,
        eventType,
        {
          pullRequest: {
            id: payload.pull_request.id,
            number: payload.pull_request.number,
            title: payload.pull_request.title,
            body: payload.pull_request.body,
            state: payload.pull_request.state,
            merged: payload.pull_request.merged,
            head: {
              ref: payload.pull_request.head.ref,
              sha: payload.pull_request.head.sha
            },
            base: {
              ref: payload.pull_request.base.ref,
              sha: payload.pull_request.base.sha
            },
            user: {
              login: payload.pull_request.user.login,
              email: payload.pull_request.user.email
            }
          },
          commits: diffs,
          repository: {
            name: payload.repository.name,
            owner: payload.repository.owner.login,
            defaultBranch: payload.repository.default_branch
          },
          sender: {
            login: payload.sender?.login,
            email: payload.sender?.email
          }
        }
      );

    } catch (error) {
      console.error('Error handling unified pull request event:', error);
    }
  }

  app.on("installation.created", async (context) => {

    const email = context.payload.sender?.email || '';
    const name = context.payload.sender?.name || '';
    const login = context.payload.sender?.login;
    const installationId = context.payload.installation.id;
    const repositories = context.payload.repositories.map((repo) => ({
      name: repo.name,
      owner: repo.full_name,
      id: repo.id
    }));
    console.log('🔧 installation.created', name, email, login, installationId, repositories);

    try {
      await VectraInterface.githubAppInstallationCallback(name, email, login, installationId, repositories);
    } catch (error) {
      console.error('Error calling githubAppInstallationCallback:', error);
    }
  });

  app.on("installation.deleted", async (context) => {
    console.log("🗑️ GitHub App installation deleted:", context.payload.sender?.login);

    const username = context.payload.sender?.login;
    const installationId = context.payload.installation.id;

    try {
      await VectraInterface.githubAppInstallationDeleted(username, installationId);
    } catch (error) {
      console.error('Error calling githubAppInstallationDeleted:', error);
    }
  });
};