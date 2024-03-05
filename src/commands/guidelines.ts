// Copyright (C) 2023-2024, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";

import analyticsClient from "../util/analytics";
import { getExtensionVersion } from "../activation/environmentSetup";
import { getUniqueId } from "../util/vscode";
import {
  fetchGuidelines,
  postGuideline,
  checkAPIAccess,
  QuackGuideline,
  patchGuideline,
  deleteGuideline,
} from "../util/quack";
import { getActiveGithubRepo } from "../util/github";

let config = vscode.workspace.getConfiguration("api");

export async function logEvent(name: string, context: vscode.ExtensionContext) {
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
    event: name,
    properties: {
      extensionVersion: getExtensionVersion(),
      repo_id: repoId,
      repo_name: repoName,
    },
  });
}

export async function pullGuidelines(context: vscode.ExtensionContext) {
  // API Checks
  if (!checkAPIAccess(context)) {
    return;
  }
  const guidelines = await fetchGuidelines(
    config.get("endpoint") as string,
    context.globalState.get("quack.quackToken") as string,
  );
  context.globalState.update("quack.guidelines", guidelines);

  // Product analytics
  await logEvent("vscode:guideline-pull", context);
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
  // API Checks
  if (!checkAPIAccess(context)) {
    return;
  }
  const guideline = await postGuideline(
    content,
    config.get("endpoint") as string,
    context.globalState.get("quack.quackToken") as string,
  );
  // Cache the new guideline
  const guidelines: QuackGuideline[] =
    context.globalState.get("quack.guidelines") || [];
  guidelines.push(guideline);
  context.globalState.update("quack.guidelines", guidelines);
  // Product analytics
  await logEvent("vscode:guideline-creation", context);
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
  index: number,
  content: string | undefined,
  context: vscode.ExtensionContext,
) {
  const guidelines: QuackGuideline[] =
    context.globalState.get("quack.guidelines") || [];
  if (guidelines.length === 0) {
    vscode.window.showErrorMessage("No guideline registered");
    return;
  }
  let editContent = content;
  if (!content) {
    editContent = await vscode.window.showInputBox({
      prompt: "The update content of your guideline",
      value: guidelines[index].content,
      ignoreFocusOut: true, // This keeps the input box open when focus is lost, which can prevent some confusion
    });
  }
  if (!editContent || editContent.length === 0) {
    vscode.window.showErrorMessage("Content cannot be empty");
    return;
  }
  // API Checks
  if (!checkAPIAccess(context)) {
    return;
  }
  await patchGuideline(
    guidelines[index].id,
    editContent,
    config.get("endpoint") as string,
    context.globalState.get("quack.quackToken") as string,
  );
  // Cache the result
  guidelines[index].content = editContent;
  context.globalState.update("quack.guidelines", guidelines);
  // Product analytics
  await logEvent("vscode:guideline-update", context);
}

export async function removeGuideline(
  index: number,
  context: vscode.ExtensionContext,
) {
  const guidelines: QuackGuideline[] =
    context.globalState.get("quack.guidelines") || [];
  if (guidelines.length === 0) {
    vscode.window.showErrorMessage("No guideline registered");
    return;
  }
  // API Checks
  if (!checkAPIAccess(context)) {
    return;
  }
  await deleteGuideline(
    guidelines[index].id,
    config.get("endpoint") as string,
    context.globalState.get("quack.quackToken") as string,
  );
  guidelines.splice(index, 1);
  context.globalState.update("quack.guidelines", guidelines);
  // Product analytics
  await logEvent("vscode:guideline-deletion", context);
}
