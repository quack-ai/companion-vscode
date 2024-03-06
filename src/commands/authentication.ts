// Copyright (C) 2023-2024, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";

import {
  verifyQuackEndpoint,
  getToken,
  getAPIAccessStatus,
} from "../util/quack";
import analyticsClient from "../util/analytics";
import { getExtensionVersion } from "../activation/environmentSetup";
import { getUniqueId } from "../util/vscode";
import { getGithubToken } from "../util/github";

let config = vscode.workspace.getConfiguration("api");

export async function setEndpoint(context: vscode.ExtensionContext) {
  // Get user input
  const quackEndpoint = await vscode.window.showInputBox({
    prompt: "Enter the endpoint URL for Quack API",
    value: config.get("endpoint"),
    ignoreFocusOut: true, // This keeps the input box open when focus is lost, which can prevent some confusion
  });
  if (quackEndpoint) {
    const isValid: boolean = await verifyQuackEndpoint(quackEndpoint);
    if (isValid) {
      // Update the workspace config entry
      config.update("endpoint", quackEndpoint, false);
      context.globalState.update("quack.isValidEndpoint", true);
      vscode.commands.executeCommand(
        "setContext",
        "quack.isValidEndpoint",
        true,
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
  let cachedToken: string | undefined =
    context.globalState.get("quack.quackToken");
  if (cachedToken) {
    return cachedToken;
  } else {
    const quackToken = await getToken(
      await getGithubToken(context),
      config.get("endpoint") as string,
    );
    context.globalState.update("quack.quackToken", quackToken);
    context.globalState.update("quack.isValidToken", true);
    vscode.commands.executeCommand("setContext", "quack.isValidToken", true);
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
  context.globalState.update("quack.isValidToken", false);
  context.globalState.update("quack.githubToken", undefined);
  context.workspaceState.update("quack.guidelines", undefined);
  vscode.commands.executeCommand("setContext", "quack.isValidToken", false);
  vscode.window.showInformationMessage("Logout successful");
}

export async function prepareAPIAccess(context: vscode.ExtensionContext) {
  // if endpoint not set, set it & verify it
  if (!config.get("endpoint")) {
    await vscode.window
      .showErrorMessage("No API endpoint set", "Configure endpoint")
      .then((choice) => {
        if (choice === "Configure endpoint") {
          // Request endpoint from user
          vscode.commands.executeCommand("quack.setEndpoint");
        }
      });
    // if it's set, make sure it works
  } else {
    if (await verifyQuackEndpoint(config.get("endpoint") as string)) {
      context.globalState.update("quack.isValidEndpoint", true);
      vscode.commands.executeCommand(
        "setContext",
        "quack.isValidEndpoint",
        true,
      );
    } else {
      await vscode.window
        .showErrorMessage("Unreachable API endpoint", "Configure endpoint")
        .then((choice) => {
          if (choice === "Configure endpoint") {
            // Request endpoint from user
            vscode.commands.executeCommand("quack.setEndpoint");
          }
        });
    }
  }
  // if endpoint set but not token --> retrieve token
  if (
    !!config.get("endpoint") &&
    !context.globalState.get("quack.quackToken")
  ) {
    await vscode.window
      .showErrorMessage("Unauthenticated", "Authenticate")
      .then((choice) => {
        if (choice === "Authenticate") {
          vscode.commands.executeCommand("quack.login");
        }
      });
    return;
  }
  // If both endpoint & token are set, check the access
  if (
    !!config.get("endpoint") &&
    !!context.globalState.get("quack.quackToken")
  ) {
    const status = await getAPIAccessStatus(
      context.globalState.get("quack.quackToken") as string,
      config.get("endpoint") as string,
    );
    if (status === "ok") {
      context.globalState.update("quack.isValidEndpoint", true);
      context.globalState.update("quack.isValidToken", true);
      vscode.commands.executeCommand(
        "setContext",
        "quack.isValidEndpoint",
        true,
      );
      vscode.commands.executeCommand("setContext", "quack.isValidToken", true);
      return;
    } else if (status === "expired-token") {
      context.globalState.update("quack.quackToken", undefined);
      context.globalState.update("quack.isValidToken", false);
      context.globalState.update("quack.isValidEndpoint", true);
      vscode.commands.executeCommand("setContext", "quack.isValidToken", false);
      await vscode.window
        .showErrorMessage("Your token has expired", "Authenticate")
        .then((choice) => {
          if (choice === "Authenticate") {
            vscode.commands.executeCommand("quack.login");
          }
        });
      return;
    } else {
      // Unknown problem
      console.log(`Unabled to verify API access: ${status}`);
      vscode.window.showErrorMessage("Unable to verify access");
    }
  }
}
