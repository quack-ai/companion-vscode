// Copyright (C) 2023-2024, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";

import analyticsClient from "../util/analytics";
import { getExtensionVersion } from "../activation/environmentSetup";
import { getUniqueId } from "../util/vscode";
import {
  checkSnippet,
  QuackGuideline,
  analyzeSnippet,
  ComplianceResult,
  fetchRepoGuidelines,
  getToken,
  postChatMessage,
  ChatMessage,
} from "../util/quack";
import { getActiveGithubRepo, getGithubToken } from "../util/github";
import {
  getCurrentRepoName,
  getSelectionText,
  getSelectionRange,
  getEditor,
} from "../util/session";
import {
  GuidelineTreeProvider,
  GuidelineTreeItem,
} from "../webviews/guidelineView";
import { ChatViewProvider } from "../webviews/chatView";

let config = vscode.workspace.getConfiguration("api");

export async function checkCodeAgainstGuideline(
  context: vscode.ExtensionContext,
  provider: GuidelineTreeProvider,
  collection: vscode.DiagnosticCollection,
  item: GuidelineTreeItem,
) {
  if (item) {
    // API prep
    if (!context.globalState.get("quack.quackToken")) {
      vscode.window
        .showErrorMessage("Please authenticate", "Authenticate")
        .then((choice) => {
          if (choice === "Authenticate") {
            vscode.commands.executeCommand("quack.login");
          }
        });
      return;
    }
    // Status bar
    // Snippet
    const codeSnippet = getSelectionText();
    const selectionRange = getSelectionRange();
    const statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
    );
    statusBarItem.text = `$(sync~spin) Processing...`;
    statusBarItem.show();
    // Request
    const complianceStatus = await checkSnippet(
      item.guideline.id,
      codeSnippet,
      config.get("endpoint") as string,
      context.globalState.get("quack.quackToken") as string,
    );

    // Notify the webview to update its content
    provider.refreshItem(item.guideline.id, complianceStatus.is_compliant);
    // Send messages
    var diagnostics: vscode.Diagnostic[] = [];
    if (!complianceStatus.is_compliant) {
      const diagnostic = new vscode.Diagnostic(
        selectionRange,
        item.guideline.title + "\n\n" + complianceStatus.comment,
        vscode.DiagnosticSeverity.Warning,
      );
      diagnostic.source = "Quack Companion";
      diagnostics.push(diagnostic);
    }
    collection.set(getEditor().document.uri, diagnostics);
    statusBarItem.dispose();
    // Telemetry
    analyticsClient?.capture({
      distinctId: await getUniqueId(context),
      event: "vscode:check-vs-guideline",
      properties: {
        extensionVersion: getExtensionVersion(),
        repo_name: await getCurrentRepoName(),
        guideline_id: item.guideline.id,
      },
    });
  } else {
    vscode.window.showErrorMessage("No guideline selected.");
  }
}

export async function checkCodeAgainstRepo(
  context: vscode.ExtensionContext,
  provider: GuidelineTreeProvider,
  collection: vscode.DiagnosticCollection,
) {
  // API prep
  if (!context.globalState.get("quack.quackToken")) {
    vscode.window
      .showErrorMessage("Please authenticate", "Authenticate")
      .then((choice) => {
        if (choice === "Authenticate") {
          vscode.commands.executeCommand("quack.login");
        }
      });
    return;
  }
  // Guidelines
  const ghRepo = await getActiveGithubRepo(context);
  const guidelines = await fetchRepoGuidelines(
    ghRepo.id,
    config.get("endpoint") as string,
    await getToken(
      await getGithubToken(context),
      config.get("endpoint") as string,
    ),
  );
  if (guidelines.length === 0) {
    vscode.window.showErrorMessage("No guideline to check the code");
    return;
  }
  // Snippet
  const codeSnippet = getSelectionText();
  const selectionRange = getSelectionRange();
  // Status bar
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
  );
  statusBarItem.text = `$(sync~spin) Processing...`;
  statusBarItem.show();

  // Analyze code
  const complianceStatus = await analyzeSnippet(
    ghRepo.id,
    codeSnippet,
    config.get("endpoint") as string,
    context.globalState.get("quack.quackToken") as string,
  );
  const statusIndexMap: { [key: number]: number } = {};
  complianceStatus.forEach((item: ComplianceResult, index: number) => {
    statusIndexMap[item.guideline_id] = index;
  });

  // UI Update
  collection.clear();
  // Notify the webview to update its content
  provider.refresh(
    guidelines.map((guideline: QuackGuideline, index: number) => ({
      ...guideline,
      completed: complianceStatus[statusIndexMap[guideline.id]].is_compliant,
    })),
  );
  // Send messages
  var diagnostics: vscode.Diagnostic[] = [];
  const guidelineIndexMap: { [key: number]: number } = {};
  guidelines.forEach((item: QuackGuideline, index: number) => {
    guidelineIndexMap[item.id] = index;
  });
  complianceStatus.forEach((item: ComplianceResult, index: number) => {
    if (!item.is_compliant) {
      const diagnostic = new vscode.Diagnostic(
        selectionRange,
        item.comment,
        vscode.DiagnosticSeverity.Warning,
      );
      diagnostic.source = "Quack Companion";
      diagnostic.code = guidelines[guidelineIndexMap[item.guideline_id]].title;
      // Add the replacement
      const relatedInfo = new vscode.DiagnosticRelatedInformation(
        new vscode.Location(getEditor().document.uri, selectionRange),
        `Not compliant with ${diagnostic.code}`,
      );
      diagnostic.relatedInformation = [relatedInfo];
      diagnostics.push(diagnostic);
    }
  });
  collection.set(getEditor().document.uri, diagnostics);

  statusBarItem.dispose();

  // Telemetry
  analyticsClient?.capture({
    distinctId: await getUniqueId(context),
    event: "vscode:check-vs-repo",
    properties: {
      extensionVersion: getExtensionVersion(),
      repo_name: ghRepo.full_name,
      repo_id: ghRepo.id,
    },
  });
}

export async function sendChatMessage(
  input: string | undefined,
  context: vscode.ExtensionContext,
  chatViewProvider: ChatViewProvider,
) {
  // Input check
  let message: string | undefined;
  if (!input) {
    message = await vscode.window.showInputBox({
      prompt: "Enter a message",
    });
  } else {
    message = input;
  }

  if (!message) {
    vscode.window.showErrorMessage("Message cannot be empty");
    return;
  }
  // API prep
  if (!context.globalState.get("quack.quackToken")) {
    vscode.window
      .showErrorMessage("Please authenticate", "Authenticate")
      .then((choice) => {
        if (choice === "Authenticate") {
          vscode.commands.executeCommand("quack.login");
        }
      });
    return;
  }
  const messages: ChatMessage[] =
    context.workspaceState.get<ChatMessage[]>("messages") || [];
  messages.push({ role: "user", content: message });
  context.workspaceState.update("messages", messages);
  messages.push({ role: "assistant", content: "" });
  chatViewProvider.refresh();
  // Status bar
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
  );
  statusBarItem.text = `$(sync~spin) Processing...`;
  statusBarItem.show();

  await postChatMessage(
    messages.slice(0, messages.length - 1),
    config.get("endpoint") as string,
    context.globalState.get("quack.quackToken") as string,
    (chunkText: string) => {
      if (chunkText.length > 0) {
        // Cache
        messages[messages.length - 1].content += chunkText;
        context.workspaceState.update("messages", messages);
        // UI
        chatViewProvider.addChunkToLastMessage(chunkText);
      }
    },
  );
  statusBarItem.dispose();

  // Telemetry
  let repoName: string | undefined = undefined;
  let repoId: number | undefined = undefined;
  // Make sure users can use it outside of git repos
  try {
    const ghRepo = await getActiveGithubRepo(context);
    repoName = ghRepo.full_name;
    repoId = ghRepo.id;
  } catch (error) {
    console.log(error);
  }

  analyticsClient?.capture({
    distinctId: await getUniqueId(context),
    event: "vscode:chat",
    properties: {
      extensionVersion: getExtensionVersion(),
      repo_name: repoName,
      repo_id: repoId,
    },
  });
}
