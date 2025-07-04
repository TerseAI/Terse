import { Probot } from "probot";

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
    console.log("GitHub App installation created:", {
      installationId: context.payload.installation.id,
      installationAccount: context.payload.installation.account,
      senderId: context.payload.sender.id,
      senderLogin: context.payload.sender.login,
      senderType: context.payload.sender.type,
      repositories: context.payload.repositories,
      fullPayload: context.payload
    });
  });

  app.on("installation", async (context) => {
    console.log("GitHub App installation event:", {
      action: context.payload.action,
      installationId: context.payload.installation.id,
      senderLogin: context.payload.sender.login
    });
  });

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};