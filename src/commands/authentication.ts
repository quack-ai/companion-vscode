// Copyright (C) 2023, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";

import { verifyQuackEndpoint, getToken } from "../util/quack";
import analyticsClient from "../util/analytics";
import { getExtensionVersion } from "../activation/environmentSetup";
import { getUniqueId } from "../util/vscode";
import { getGithubToken } from "../util/github";

let config = vscode.workspace.getConfiguration("api");

export async function setEndpoint(context: vscode.ExtensionContext) {
  // Get user input
  const quackEndpoint = await vscode.window.showInputBox({
    prompt: "Enter the endpoint URL for Quack API",
    placeHolder: config.get("endpoint"),
    ignoreFocusOut: true, // This keeps the input box open when focus is lost, which can prevent some confusion
  });
  if (quackEndpoint) {
    const isValid: boolean = await verifyQuackEndpoint(quackEndpoint);
    if (isValid) {
      // Update the workspace config entry
      config.update("endpoint", quackEndpoint, false);
      // Reset the token
      await context.workspaceState.update(
        "quack-companion.quackToken",
        undefined,
      );
      vscode.window.showInformationMessage("Quack endpoint set successfully");
    } else {
      vscode.window.showErrorMessage(
        "Failed to access a Quack API instance at the specified URL",
      );
    }
  } else {
    vscode.window.showErrorMessage("Quack endpoint URL is required");
  }
  analyticsClient?.capture({
    distinctId: await getUniqueId(context),
    event: "vscode:set-endpoint",
    properties: {
      extensionVersion: getExtensionVersion(),
    },
  });
}

export async function login(context: vscode.ExtensionContext) {
  // Check if it's in cache
  let cachedToken: string | undefined = context.globalState.get(
    "quack-companion.quackToken",
  );
  if (cachedToken) {
    return cachedToken;
  } else {
    const quackToken = await getToken(
      await getGithubToken(context),
      config.get("endpoint") as string,
    );
    context.globalState.update("quack-companion.quackToken", quackToken);
    vscode.commands.executeCommand("setContext", "quack.isAuthenticated", true);
    vscode.window.showInformationMessage("Authentication successful");
    analyticsClient?.capture({
      distinctId: await getUniqueId(context),
      event: "vscode:login",
      properties: {
        extensionVersion: getExtensionVersion(),
      },
    });
    return quackToken;
  }
}

export async function logout(context: vscode.ExtensionContext) {
  analyticsClient?.capture({
    distinctId: await getUniqueId(context),
    event: "vscode:logout",
    properties: {
      extensionVersion: getExtensionVersion(),
    },
  });
  context.globalState.update("quack.quackToken", undefined);
  context.globalState.update("quack.githubToken", undefined);
  context.workspaceState.update("quack.guidelines", undefined);
  vscode.commands.executeCommand("setContext", "quack.isAuthenticated", false);
  vscode.window.showInformationMessage("Logout successful");
}
