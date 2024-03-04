// Copyright (C) 2023-2024, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";

import analyticsClient from "../util/analytics";
import { getExtensionVersion } from "../activation/environmentSetup";
import { getUniqueId } from "../util/vscode";
import { fetchRepoGuidelines, addRepoToQueue } from "../util/quack";
import { getActiveGithubRepo } from "../util/github";
import { GuidelineTreeProvider } from "../webviews/guidelineView";

let config = vscode.workspace.getConfiguration("api");

export async function fetchGuidelines(
  context: vscode.ExtensionContext,
  provider: GuidelineTreeProvider,
  collection: vscode.DiagnosticCollection,
) {
  const ghRepo = await getActiveGithubRepo(context);
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
  const guidelines = await fetchRepoGuidelines(
    ghRepo.id,
    config.get("endpoint") as string,
    context.globalState.get("quack.quackToken") as string,
  );
  context.workspaceState.update("quack.guidelines", guidelines);

  // UI update
  provider.refresh(
    guidelines.map((guideline: any) => ({
      ...guideline,
      completed: false,
    })),
  );
  collection.clear();

  // If no guidelines exists, say it in the console
  if (guidelines.length === 0) {
    vscode.window
      .showInformationMessage(
        "No guidelines specified yet. Do you wish to request some?",
        "Request guidelines",
      )
      .then((choice) => {
        if (choice === "Request guidelines") {
          addRepoToQueue(
            ghRepo.id,
            config.get("endpoint") as string,
            context.globalState.get("quack.quackToken") as string,
          );
          vscode.window.showInformationMessage(
            "Request sent (automatic guideline extraction has been queued).",
          );
        }
      });
  }

  analyticsClient?.capture({
    distinctId: await getUniqueId(context),
    event: "vscode:fetch-guidelines",
    properties: {
      extensionVersion: getExtensionVersion(),
      repo_id: ghRepo.id,
      repo_name: ghRepo.full_name,
    },
  });
}

export interface Guideline {
  enabled: boolean;
  content: string;
}

export async function createGuideline(
  input: string | undefined,
  context: vscode.ExtensionContext,
) {
  // Input check
  let content: string | undefined;
  if (!input) {
    content = await vscode.window.showInputBox({
      prompt: "What is your guideline?",
    });
  } else {
    content = input;
  }
  if (!content || content.length === 0) {
    vscode.window.showErrorMessage("Content cannot be empty");
    return;
  }
  // Cache the new guideline
  const guidelines: Guideline[] =
    context.globalState.get<Guideline[]>("quack.guidelines") || [];
  guidelines.push({ content: content, enabled: true });
  context.globalState.update("quack.guidelines", guidelines);
  vscode.window.showInformationMessage("Guideline created!");
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
    event: "vscode:guideline-creation",
    properties: {
      extensionVersion: getExtensionVersion(),
      repo_name: repoName,
      repo_id: repoId,
    },
  });
}

export async function listGuidelines(context: vscode.ExtensionContext) {
  // Cache the new guideline
  const guidelines: Guideline[] =
    context.globalState.get<Guideline[]>("quack.guidelines") || [];
  if (guidelines.length === 0) {
    vscode.window.showErrorMessage("No guideline registered");
    return;
  }
  const quickPickItems = guidelines.map((guideline) => ({
    label: guideline.content,
  }));
  await vscode.window.showQuickPick(quickPickItems, {});
}

export async function editGuideline(
  index: number | undefined,
  content: string | undefined,
  context: vscode.ExtensionContext,
) {
  const guidelines: Guideline[] =
    context.globalState.get<Guideline[]>("quack.guidelines") || [];
  if (guidelines.length === 0) {
    vscode.window.showErrorMessage("No guideline registered");
    return;
  }
  let editIndex = index;
  if (!index) {
    const quickPickItems = guidelines.map((guideline) => ({
      label: guideline.content,
    }));
    const selection = await vscode.window.showQuickPick(quickPickItems, {
      placeHolder: "Select the guideline to edit",
    });
    if (selection) {
      editIndex = guidelines.map((g) => g.content).indexOf(selection.label);
    }
  }
  if (typeof editIndex === "undefined") {
    return;
  }
  let editContent = content;
  if (!content) {
    editContent = await vscode.window.showInputBox({
      prompt: "The update content of your guideline",
      value: guidelines[editIndex].content,
      ignoreFocusOut: true, // This keeps the input box open when focus is lost, which can prevent some confusion
    });
  }
  if (!editContent || editContent.length === 0) {
    vscode.window.showErrorMessage("Content cannot be empty");
    return;
  }
  // Cache the new guideline
  guidelines[editIndex].content = editContent;
  context.globalState.update("quack.guidelines", guidelines);
  vscode.window.showInformationMessage("Guideline updated!");
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
    event: "vscode:guideline-update",
    properties: {
      extensionVersion: getExtensionVersion(),
      repo_name: repoName,
      repo_id: repoId,
    },
  });
}

export async function deleteGuideline(
  index: number | undefined,
  context: vscode.ExtensionContext,
) {
  const guidelines: Guideline[] =
    context.globalState.get<Guideline[]>("quack.guidelines") || [];
  if (guidelines.length === 0) {
    vscode.window.showErrorMessage("No guideline registered");
    return;
  }
  let deletionIndex = index;
  if (!index) {
    const quickPickItems = guidelines.map((guideline) => ({
      label: guideline.content,
    }));
    const selection = await vscode.window.showQuickPick(quickPickItems, {
      placeHolder: "Select the guideline to delete",
    });
    if (selection) {
      deletionIndex = guidelines.map((g) => g.content).indexOf(selection.label);
    }
  }
  if (typeof deletionIndex === "undefined") {
    return;
  }
  guidelines.splice(deletionIndex as number, 1);
  context.globalState.update("quack.guidelines", guidelines);
  vscode.window.showInformationMessage("Guideline deleted!");
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
    event: "vscode:guideline-deletion",
    properties: {
      extensionVersion: getExtensionVersion(),
      repo_name: repoName,
      repo_id: repoId,
    },
  });
}
