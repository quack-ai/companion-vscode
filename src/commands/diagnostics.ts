// Copyright (C) 2023-2024, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";

import { getExtensionVersion } from "../activation/environmentSetup";
import * as os from "os";
import clipboardy from "clipboardy";

let config = vscode.workspace.getConfiguration("api");

export function getEnvInfo() {
  const extensionVersion = getExtensionVersion();
  const info = `OS: ${os.platform()} ${os.release()}\nVSCode Version: ${
    vscode.version
  }\nExtension Version: ${extensionVersion}\nEndpoint: ${config.get(
    "endpoint",
  )}`;
  clipboardy.writeSync(info);
  vscode.window.showInformationMessage("Version info copied to clipboard.");
}
