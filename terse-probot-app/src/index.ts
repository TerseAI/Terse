import { Probot } from "probot";
import { VectraInterface } from "./vectraInterface.js";

export default (app: Probot) => {
  console.log("Probot app starting up...");

  app.on("issues.opened", async (context) => {
    const issueComment = context.issue({
      body: "Thanks for opening this issue!",
    });
    await context.octokit.issues.createComment(issueComment);
  });

  app.on("push", async (context) => {
    console.log("push", context.payload);
  });

  app.on("installation.created", async (context) => {

    const email = context.payload.sender?.email || '';
    const name = context.payload.sender?.name || '';
    const login = context.payload.sender?.login;
    const installationId = context.payload.installation.id;
    const repositoryName = context.payload.repositories?.[0]?.name || '';

    console.log('installation.created', context.payload);

    console.log('installation.created', name, email, login, installationId, repositoryName);

    try {
      await VectraInterface.githubAppInstallationCallback(name, email, login, installationId, repositoryName);
    } catch (error) {
      console.error('Error calling githubAppInstallationCallback:', error);
    }
  });

  app.on("installation.deleted", async (context) => {
    console.log("GitHub App installation deleted:", context.payload);

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