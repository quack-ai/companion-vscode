// Copyright (C) 2023, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";
import * as os from "os";
import { v4 as uuidv4 } from "uuid";
import clipboardy from "clipboardy";
import { GuidelineProvider } from "./webviews/GuidelineProvider";
import telemetryClient from "./telemetry";
import { getCurrentRepoName } from "./util/session";
import {
  getRepoDetails,
  fetchStarterIssues,
  GitHubRepo,
  GithubIssue,
  searchIssues,
} from "./util/github";
import { fetchRepoGuidelines, QuackGuideline } from "./quack";

export function activate(context: vscode.ExtensionContext) {
  // Generate or retrieve the user's UUID from storage
  let stateId: string | undefined = context.globalState.get("userId");
  const userId: string = stateId || uuidv4();
  if (!stateId) {
    context.globalState.update("userId", userId);
  }

  // Side bar
  const guidelineView = new GuidelineProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "quack-companion.guidelineView",
      guidelineView,
    ),
  );

  // Status bar buttons
  // Guideline refresh
  const refreshStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
  );
  refreshStatusBar.text = "$(refresh) Refresh guidelines";
  refreshStatusBar.command = "quack-companion.fetchGuidelines";
  refreshStatusBar.show();
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
        // Check the cache
        const cachedGuidelines: QuackGuideline[] | undefined =
          context.globalState.get("quack-companion.repoGuidelines");
        var guidelines: QuackGuideline[] = [];
        if (cachedGuidelines) {
          guidelines = cachedGuidelines;
        } else {
          const ghRepo: GitHubRepo = await getRepoDetails(repoName);
          guidelines = await fetchRepoGuidelines(ghRepo.id);
          context.globalState.update(
            "quack-companion.repoGuidelines",
            guidelines,
          );
        }

        // If no guidelines exists, say it in the console
        if (guidelines.length === 0) {
          vscode.window.showInformationMessage("No guidelines specified yet.");
        }

        // Notify the webview to update its content
        guidelineView.refresh(
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

  // Commands to be run when activating
  vscode.commands.executeCommand("quack-companion.fetchGuidelines");
}

export function deactivate() {
  telemetryClient?.shutdownAsync();
}
