// Copyright (C) 2023-2024, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";
import { machineIdSync } from "node-machine-id";
import { getGithubUserId } from "./github";

export function getMachineId() {
  const id = vscode.env.machineId;
  if (id === "someValue.machineId") {
    return machineIdSync();
  }
  return vscode.env.machineId;
}

export async function getUniqueId(context: vscode.ExtensionContext) {
  // Fallback for analytics identifier
  return (await getGithubUserId(context)) || getMachineId();
}
