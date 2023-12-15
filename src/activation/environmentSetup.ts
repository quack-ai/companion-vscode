// Copyright (C) 2023, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";

export function getExtensionVersion() {
  const extension = vscode.extensions.getExtension("quackai.quack-companion");
  return extension?.packageJSON.version || "N/A";
}
