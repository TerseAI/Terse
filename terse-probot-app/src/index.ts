import { Probot } from "probot";
import { VectraInterface, Commit, FileDiff } from "./vectraInterface.js";

export default (app: Probot) => {
  console.log("Probot app starting up...");

  app.onAny(async (context) => {
    console.log("🔔 Event received:", context.name);
  });

  app.on("issues.opened", async (context) => {
    console.log("📝 Issue opened:", context.payload.issue?.title);
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
          console.log(`\nFile: ${file.filename}`);
          console.log(`Status: ${file.status}`); // added, modified, removed
          console.log(`Changes: +${file.additions} -${file.deletions}`);

          // The actual diff patch
          if (file.patch) {
            console.log('Diff:');
            console.log(file.patch);
            fileDiffs.push({
              filename: file.filename,
              diff: file.patch
            });
          }
        }

        diffs.push({
          name: commit.message,
          fileDiffs: fileDiffs
        });

      } catch (error) {
        console.error(`Error fetching commit ${commit.id}:`, error);
      }
    }

    try {
      await VectraInterface.githubPushEvent(context.payload.sender?.login, installationId, context.payload.repository.name, context.payload.ref, diffs);
    } catch (error) {
      console.error('Error calling githubAppRecievedPush:', error);
    }
  });

  app.on("installation.created", async (context) => {

    const email = context.payload.sender?.email || '';
    const name = context.payload.sender?.name || '';
    const login = context.payload.sender?.login;
    const installationId = context.payload.installation.id;
    const repositoryName = context.payload.repositories?.[0]?.name || '';

    console.log('🔧 installation.created', name, email, login, installationId, repositoryName);

    try {
      await VectraInterface.githubAppInstallationCallback(name, email, login, installationId, repositoryName);
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

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};