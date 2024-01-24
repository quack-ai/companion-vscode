// Copyright (C) 2023-2024, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";
import { getExtensionVersion } from "./activation/environmentSetup";
import analyticsClient from "./util/analytics";
import { getMachineId } from "./util/vscode";
import { getGithubUserId } from "./util/github";

let uniqueId: string = getMachineId();

export async function activate(context: vscode.ExtensionContext) {
  uniqueId = await getGithubUserId(context);
  // Fresh installation
  if (!context.globalState.get("hasBeenInstalled")) {
    context.globalState.update("hasBeenInstalled", true);
    analyticsClient?.capture({
      distinctId: uniqueId,
      event: "vscode:install",
      properties: {
        extensionVersion: getExtensionVersion(),
      },
    });
  }

  // Activation
  const { activateExtension } = await import("./activation/activate");
  try {
    await activateExtension(context);
    analyticsClient?.capture({
      distinctId: uniqueId,
      event: "vscode:activate",
      properties: {
        extensionVersion: getExtensionVersion(),
      },
    });
  } catch (e) {
    console.log("Error activating extension: ", e);
    vscode.window
      .showInformationMessage("Error activating the extension.", "Retry")
      .then((selection) => {
        if (selection === "Retry") {
          // Reload VS Code window
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
      });
  }
}

export function deactivate() {
  analyticsClient?.capture({
    distinctId: uniqueId,
    event: "vscode:deactivate",
    properties: {
      extensionVersion: getExtensionVersion(),
    },
  });

  analyticsClient?.shutdownAsync();
}
