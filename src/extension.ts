// Copyright (C) 2023, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";
import * as os from "os";
import { v4 as uuidv4 } from "uuid";
import clipboardy from "clipboardy";
import { GuidelineTreeProvider } from "./webviews/guidelineView";
import telemetryClient from "./telemetry";
import { getCurrentRepoName } from "./util/session";
import {
  getRepoDetails,
  fetchStarterIssues,
  GitHubRepo,
  GithubIssue,
  searchIssues,
} from "./util/github";
import {
  fetchRepoGuidelines,
  QuackGuideline,
  verifyQuackEndpoint,
  authenticate,
} from "./quack";

function updateContext(context: vscode.ExtensionContext) {
  const quackToken = context.workspaceState.get<string>(
    "quack-companion.quackToken",
  );
  vscode.commands.executeCommand(
    "setContext",
    "quack-companion.hasQuackToken",
    !!quackToken,
  );
}

export function activate(context: vscode.ExtensionContext) {
  // Generate or retrieve the user's UUID from storage
  let stateId: string | undefined = context.workspaceState.get("userId");
  const userId: string = stateId || uuidv4();
  if (!stateId) {
    context.workspaceState.update("userId", userId);
  }

  // Default endpoint
  let endpointURL: string | undefined = context.workspaceState.get(
    "quack-companion.endpointURL",
  );
  if (!endpointURL) {
    context.workspaceState.update(
      "quack-companion.endpointURL",
      "https://api.quackai.com",
    );
  }

  // Side bar
  const guidelineTreeView = new GuidelineTreeProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "quack-companion.guidelineTreeView",
      guidelineTreeView,
    ),
  );

  // Status bar buttons
  // Find starter issues
  const starterStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
  );
  starterStatusBar.text = "$(search-fuzzy) Find starter issues";
  starterStatusBar.command = "quack-companion.findStarterIssues";
  starterStatusBar.show();

  interface TransformedGuideline {
    id: number;
    label: string;
    detail: string;
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "quack-companion.fetchGuidelines",
      async () => {
        const repoName: string = await getCurrentRepoName();
        const ghRepo: GitHubRepo = await getRepoDetails(repoName);
        const endpoint: string =
          context.workspaceState.get("quack-companion.endpointURL") ||
          "https://api.quackai.com";
        const quackToken = context.workspaceState.get<string>(
          "quack-companion.quackToken",
        );
        if (!quackToken) {
          vscode.window.showErrorMessage("Please authenticate");
          return;
        }
        const guidelines: QuackGuideline[] = await fetchRepoGuidelines(ghRepo.id, endpoint, quackToken);
        context.workspaceState.update(
          "quack-companion.repoGuidelines",
          guidelines,
        );

        // If no guidelines exists, say it in the console
        if (guidelines.length === 0) {
          vscode.window.showInformationMessage("No guidelines specified yet.");
        }

        // Notify the webview to update its content
        guidelineTreeView.refresh(
          guidelines.map((guideline: any) => ({
            ...guideline,
            completed: false,
          })),
        );

        // Telemetry
        telemetryClient?.capture({
          distinctId: userId,
          event: "vscode-fetch-guidelines",
          properties: {
            repository: repoName,
          },
        });
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "quack-companion.findStarterIssues",
      async () => {
        const currentName: string = await getCurrentRepoName();
        const repoName = await vscode.window.showInputBox({
          prompt: "To which repo would you like to contribute?",
          placeHolder: currentName,
        });
        if (repoName === undefined) {
          return;
        }
        const selectedRepo = await getRepoDetails(repoName);
        const ghIssues: GithubIssue[] = await fetchStarterIssues(selectedRepo);

        // Telemetry
        telemetryClient?.capture({
          distinctId: userId,
          event: "vscode-find-starter-issues",
          properties: {
            repository: repoName,
          },
        });

        // Let user pick one
        const ghIssue = await vscode.window.showQuickPick(
          ghIssues.map((issue) => {
            return {
              label: issue.title,
              detail: issue.body,
              url: issue.html_url,
            };
          }),
          {
            matchOnDetail: true,
          },
        );

        if (ghIssue === undefined) {
          return;
        } else {
          vscode.env.openExternal(vscode.Uri.parse(ghIssue.url));
        }
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("quack-companion.defineGoal", async () => {
      const contribGoal = await vscode.window.showInputBox({
        prompt: "What are you working on?",
        placeHolder: "A few words about your intended PR",
      });
      if (contribGoal === undefined) {
        return;
      }
      const currentName: string = await getCurrentRepoName();
      // Telemetry
      telemetryClient?.capture({
        distinctId: userId,
        event: "vscode-goal-definition",
        properties: {
          repository: currentName,
        },
      });
      // Check that the contribution is well aligned
      const answer = await vscode.window.showInformationMessage(
        "Do you wish to check whether there is an existing GitHub issue/PR already?",
        "yes",
        "no",
      );
      if (answer === "yes") {
        const relatedIssues: GithubIssue[] = await searchIssues(
          currentName,
          contribGoal,
        );
        // Display
        // Let user pick one
        const ghIssue = await vscode.window.showQuickPick(
          relatedIssues.map((issue) => {
            return {
              label: issue.title,
              detail: issue.body,
              html_url: issue.html_url,
            };
          }),
          {
            matchOnDetail: true,
          },
        );

        if (ghIssue === undefined) {
          return;
        }
        vscode.env.openExternal(vscode.Uri.parse(ghIssue.html_url));
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("quack-companion.debugInfo", async () => {
      const extensionVersion =
        vscode.extensions.getExtension("quackai.quack-companion")?.packageJSON
          .version || "N/A";
      const vscodeVersion = vscode.version;
      const osName = os.platform();
      const osVersion = os.release();
      const info = `OS: ${osName} ${osVersion}\nVSCode Version: ${vscodeVersion}\nExtension Version: ${extensionVersion}`;
      clipboardy.writeSync(info);
      vscode.window.showInformationMessage("Version info copied to clipboard.");
      if (extensionVersion === "N/A") {
        vscode.window.showWarningMessage(
          "Could not retrieve extension version.",
        );
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("quack-companion.setEndpoint", async () => {
      // Get user input
      const quackEndpoint = await vscode.window.showInputBox({
        prompt: "Enter the endpoint URL for Quack API",
        placeHolder: "https://api.quackai.com/",
        ignoreFocusOut: true, // This keeps the input box open when focus is lost, which can prevent some confusion
      });
      if (quackEndpoint) {
        console.log(quackEndpoint);
        const isValid: boolean = await verifyQuackEndpoint(quackEndpoint);
        if (isValid) {
          // Update the global context state
          await context.workspaceState.update(
            "quack-companion.endpointURL",
            quackEndpoint,
          );
          vscode.window.showInformationMessage(
            "Quack endpoint set successfully",
          );
        } else {
          vscode.window.showErrorMessage(
            "Failed to access a Quack API instance at the specified URL",
          );
        }
      } else {
        vscode.window.showErrorMessage("Quack endpoint URL is required");
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("quack-companion.loginQuack", async () => {
      // GitHub login
      const session = await vscode.authentication.getSession(
        "github",
        ["read:user"],
        { createIfNone: true },
      );
      await context.workspaceState.update(
        "quack-companion.githubToken",
        session.accessToken,
      );
      // Quack login
      const endpoint: string =
        context.workspaceState.get("quack-companion.endpointURL") ||
        "https://api.quackai.com";
      const quackToken = await authenticate(session.accessToken, endpoint);
      if (quackToken) {
        await context.workspaceState.update(
          "quack-companion.quackToken",
          quackToken,
        );
        vscode.window.showInformationMessage("Authentication successful");
        // Make state available to viewsWelcome
        updateContext(context);
      }
    }),
  );
  // Commands to be run when activating
  vscode.commands.executeCommand("quack-companion.fetchGuidelines");
}

export function deactivate() {
  telemetryClient?.shutdownAsync();
}
