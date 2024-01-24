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
