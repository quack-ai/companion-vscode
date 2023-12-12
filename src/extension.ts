// Copyright (C) 2023, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";
import * as os from "os";
import { v4 as uuidv4 } from "uuid";
import clipboardy from "clipboardy";
import {
  GuidelineTreeItem,
  GuidelineTreeProvider,
} from "./webviews/guidelineView";
import telemetryClient from "./telemetry";
import {
  getCurrentRepoName,
  getSelectionText,
  getSelectionRange,
  getEditor,
} from "./util/session";
import {
  getRepoDetails,
  fetchStarterIssues,
  GitHubRepo,
  GithubIssue,
  searchIssues,
} from "./util/github";
import {
  analyzeSnippet,
  checkSnippet,
  addRepoToWaitlist,
  fetchRepoGuidelines,
  QuackGuideline,
  ComplianceResult,
  GuidelineCompliance,
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
  // Check compliance
  const complianceStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
  );
  complianceStatusBar.text = "$(pass) Check compliance";
  complianceStatusBar.command = "quack-companion.checkCompliance";
  complianceStatusBar.show();

  interface TransformedGuideline {
    id: number;
    label: string;
    detail: string;
  }

  // Diagnostic/warning collection
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection("quack-companion");

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
        const guidelines: QuackGuideline[] = await fetchRepoGuidelines(
          ghRepo.id,
          endpoint,
          quackToken,
        );
        context.workspaceState.update(
          "quack-companion.repoGuidelines",
          guidelines,
        );

        // Notify the webview to update its content
        guidelineTreeView.refresh(
          guidelines.map((guideline: any) => ({
            ...guideline,
            completed: false,
          })),
        );

        // If no guidelines exists, say it in the console
        if (guidelines.length === 0) {
          vscode.window.showInformationMessage("No guidelines specified yet.");
          const answer = await vscode.window.showInformationMessage(
            "No guidelines specified yet. Do you wish to request some?",
            "yes",
            "no",
          );
          if (answer === "yes") {
            // add to waitlist
            await addRepoToWaitlist(ghRepo.id, endpoint, quackToken);
          }
        }

        // Telemetry
        telemetryClient?.capture({
          distinctId: userId,
          event: "vscode-fetch-guidelines",
          properties: {
            repository: repoName,
          },
        });
        diagnosticCollection.clear();
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("quack-companion.debugInfo", async () => {
      const extensionVersion =
        vscode.extensions.getExtension("quackai.quack-companion")?.packageJSON
          .version || "N/A";
      const vscodeVersion = vscode.version;
      const osName = os.platform();
      const osVersion = os.release();
      const usedEndpoint: string = await context.workspaceState.get(
        "quack-companion.endpointURL",
        "https://api.quackai.com/",
      );
      const info = `OS: ${osName} ${osVersion}\nVSCode Version: ${vscodeVersion}\nExtension Version: ${extensionVersion}\nEndpoint: ${usedEndpoint}`;
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
    vscode.commands.registerCommand("quack-companion.analyzeCode", async () => {
      // Snippet
      const codeSnippet = getSelectionText();
      const repoName: string = await getCurrentRepoName();
      const ghRepo: GitHubRepo = await getRepoDetails(repoName);
      // Status bar
      const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
      );
      statusBarItem.text = `$(sync~spin) Processing...`;
      statusBarItem.show();

      // Guidelines
      const cachedGuidelines: QuackGuideline[] | undefined =
        context.workspaceState.get("quack-companion.repoGuidelines");
      var guidelines: QuackGuideline[] = [];
      if (cachedGuidelines) {
        guidelines = cachedGuidelines;
      } else {
        vscode.window.showErrorMessage("Please refresh guidelines");
        return;
      }

      if (guidelines.length > 0) {
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
        // Check compliance
        const complianceStatus: ComplianceResult[] = await analyzeSnippet(
          ghRepo.id,
          codeSnippet,
          endpoint,
          quackToken,
        );
        const statusIndexMap: { [key: number]: number } = {};
        complianceStatus.forEach((item: ComplianceResult, index: number) => {
          statusIndexMap[item.guideline_id] = index;
        });
        diagnosticCollection.clear();
        // Notify the webview to update its content
        guidelineTreeView.refresh(
          guidelines.map((guideline: QuackGuideline, index: number) => ({
            ...guideline,
            completed:
              complianceStatus[statusIndexMap[guideline.id]].is_compliant,
          })),
        );
        // Send messages
        const selectionRange = getSelectionRange();
        var diagnostics: vscode.Diagnostic[] = [];
        const guidelineIndexMap: { [key: number]: number } = {};
        guidelines.forEach((item: QuackGuideline, index: number) => {
          guidelineIndexMap[item.id] = index;
        });
        complianceStatus.forEach((item: ComplianceResult, index: number) => {
          if (!item.is_compliant) {
            vscode.window.showWarningMessage(
              guidelines[guidelineIndexMap[item.guideline_id]].title +
                ". " +
                item.comment,
            );
            const diagnostic = new vscode.Diagnostic(
              selectionRange,
              guidelines[guidelineIndexMap[item.guideline_id]].title +
                "\n\n" +
                item.comment,
              vscode.DiagnosticSeverity.Warning,
            );
            diagnostic.source = "Quack Companion";
            // diagnostic.code = guidelines[index].title;
            // // Add the replacement
            // const relatedInfo = new vscode.DiagnosticRelatedInformation(
            //   new vscode.Location(
            //     editor.document.uri,
            //     selectionRange,
            //   ),
            //   item.suggestion,
            // );
            // diagnostic.relatedInformation = [relatedInfo];
            diagnostics.push(diagnostic);
          }
        });
        diagnosticCollection.set(getEditor().document.uri, diagnostics);
      }
      statusBarItem.dispose();
      // console.log(vscode.window.activeTextEditor?.document.languageId);

      // Telemetry
      telemetryClient?.capture({
        distinctId: userId,
        event: "vscode-analyze-code",
        properties: {
          repository: repoName,
        },
      });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "quack-companion.analyzeCodeMonoGuideline",
      async (item: GuidelineTreeItem) => {
        if (item) {
          // Snippet
          const codeSnippet = getSelectionText();
          // API prep
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
          // Status bar
          const statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
          );
          statusBarItem.text = `$(sync~spin) Processing...`;
          statusBarItem.show();
          // Request
          const complianceStatus: ComplianceResult = await checkSnippet(
            item.guideline.id,
            codeSnippet,
            endpoint,
            quackToken,
          );
          //
          // Guidelines
          const cachedGuidelines: QuackGuideline[] | undefined =
            context.workspaceState.get("quack-companion.repoGuidelines");
          var guidelines: QuackGuideline[] = [];
          if (cachedGuidelines) {
            guidelines = cachedGuidelines;
          } else {
            vscode.window.showErrorMessage("Please refresh guidelines");
            return;
          }
          // Notify the webview to update its content
          guidelineTreeView.refreshItem(
            item.guideline.id,
            complianceStatus.is_compliant,
          );
          // Send messages
          const selectionRange = getSelectionRange();
          var diagnostics: vscode.Diagnostic[] = [];
          if (!complianceStatus.is_compliant) {
            vscode.window.showWarningMessage(
              item.guideline.title + ". " + complianceStatus.comment,
            );
            const diagnostic = new vscode.Diagnostic(
              selectionRange,
              item.guideline.title + "\n\n" + complianceStatus.comment,
              vscode.DiagnosticSeverity.Warning,
            );
            diagnostic.source = "Quack Companion";
            diagnostics.push(diagnostic);
          }
          diagnosticCollection.set(getEditor().document.uri, diagnostics);
          statusBarItem.dispose();
          // Telemetry
          telemetryClient?.capture({
            distinctId: userId,
            event: "vscode-analyze-code-mono",
            properties: {
              repository: await getCurrentRepoName(),
            },
          });
        } else {
          vscode.window.showErrorMessage("No guideline selected.");
        }
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "quack-companion.resetQuackWarning",
      async () => {
        diagnosticCollection.clear();
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("quack-companion.setEndpoint", async () => {
      // Get user input
      const defaultEndpoint: string =
        (await context.workspaceState.get("quack-companion.endpointURL")) ||
        "https://api.quackai.com/";
      const quackEndpoint = await vscode.window.showInputBox({
        prompt: "Enter the endpoint URL for Quack API",
        placeHolder: defaultEndpoint,
        ignoreFocusOut: true, // This keeps the input box open when focus is lost, which can prevent some confusion
      });
      if (quackEndpoint) {
        const isValid: boolean = await verifyQuackEndpoint(quackEndpoint);
        if (isValid) {
          // Update the global context state
          await context.workspaceState.update(
            "quack-companion.endpointURL",
            quackEndpoint,
          );
          // Reset the token
          await context.workspaceState.update(
            "quack-companion.quackToken",
            undefined,
          );
          updateContext(context);
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
  // Update context
  updateContext(context);
  // Commands to be run when activating
  vscode.commands.executeCommand("quack-companion.fetchGuidelines");
}

export function deactivate() {
  telemetryClient?.shutdownAsync();
}
