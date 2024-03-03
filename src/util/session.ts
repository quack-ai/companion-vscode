// Copyright (C) 2023-2024, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";
import { ChildProcess, spawn } from "child_process";

function getGitHubURLFromOutput(output: string): string | null {
  const remoteRegex =
    /origin\s+(?:git@github\.com:|https:\/\/github\.com\/)(.+?)\.git\s+\(fetch\)/;
  const match = remoteRegex.exec(output);
  return match ? match[1] : null;
}

export async function getCurrentRepoName(): Promise<string> {
  return new Promise((resolve, reject) => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window
        .showErrorMessage("No workspace opened.", "Open Folder")
        .then((choice) => {
          if (choice === "Open Folder") {
            vscode.commands.executeCommand("vscode.openFolder");
          }
        });
      reject("No workspace opened.");
      return;
    }

    const currentFolder = workspaceFolders[0]; // Assuming single-root workspace

    // Check if git is installed
    const gitExecutable: string =
      vscode.workspace.getConfiguration("git").get("path") || "git";
    const gitProcess: ChildProcess = spawn(gitExecutable, ["remote", "-v"], {
      cwd: currentFolder.uri.fsPath,
    });

    let output = "";

    gitProcess.stdout?.on("data", (data) => {
      output += data.toString();
    });

    gitProcess.stderr?.on("data", (error) => {
      console.error(error.toString());
      vscode.window.showErrorMessage(
        "Failed to get remote URLs. Make sure Git is installed and the repository has remotes.",
      );
      reject("Failed to get remote URLs.");
    });

    gitProcess.on("close", (_code) => {
      const repoName: string | null = getGitHubURLFromOutput(output);
      if (repoName) {
        resolve(repoName);
      } else {
        vscode.window.showWarningMessage("No remote GitHub URL found.");
        resolve(""); // Return a default value (empty string) if GitHub URL is not found.
      }
    });
  });
}

export function getEditor(): vscode.TextEditor {
  // Snippet
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor.");
    throw new Error("No active editor.");
  }
  return editor;
}

export function getSelectionText(): string {
  // Snippet
  const editor = getEditor();
  const selectionText = editor.document.getText(editor.selection);
  if (selectionText.length === 0) {
    vscode.window.showWarningMessage("No snippet selected.");
    throw new Error("No snippet selected.");
  }
  return selectionText;
}

export function getSelectionRange(): vscode.Range {
  // Snippet
  const editor = getEditor();
  return new vscode.Range(
    editor.selection.start.line,
    editor.selection.start.character,
    editor.selection.end.line,
    editor.selection.end.character,
  );
}
