// Copyright (C) 2023, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";
import { getCurrentRepoName } from "../util/session";
import { getRepoDetails, searchIssues } from "../util/github";
import { getNonce } from "../util/getNonce";
import axios from "axios";

interface Label {
  id: number;
  name: string;
}

export class ScopeProvider implements vscode.WebviewViewProvider {
  _view?: vscode.WebviewView;
  _doc?: vscode.TextDocument;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public async resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,

      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "onGoal": {
          if (!data.value) {
            return;
          }
          const answer = await vscode.window.showInformationMessage(
            "Do you wish to check whether there is a GitHub issue already?",
            "yes",
            "no",
          );
          if (answer === "yes") {
            // Identify current repo
            const repoName = await getCurrentRepoName();
            // // Turn it into a query
            // const repoUrl = `https://www.github.com/${repoName}`;
            // // Replace the spaces in the name of the label by + signs
            // const topicQuery : string = data.value.replace(/\s+/g, "+");
            // // Open the browser with that filter
            // const uri = vscode.Uri.parse(`${repoUrl}/issues?q=is%3Aissue+"${topicQuery}"`);
            // vscode.env.openExternal(uri);
            // Check available issues & PRs
            const relatedIssues = await searchIssues(repoName, data.value);
          }
          break;
        }
        case "onFindStarterIssues": {
          if (!data.value) {
            return;
          }
          // Identify current repo
          const currentRepoName = await getCurrentRepoName();
          const githubRepo = await getRepoDetails(currentRepoName);

          // https://docs.github.com/en/rest/issues/labels?apiVersion=2022-11-28#list-labels-for-a-repository
          const response = await axios.get(
            `https://api.github.com/repos/${githubRepo.full_name}/labels`,
          );
          const repoLabels = response.data.map((label: any) => {
            return {
              id: label.id,
              name: label.name,
            };
          });

          // Locate the good first issue
          const searchLabel = "good first issue";
          const matchedLabel = repoLabels.find(
            (label: Label) =>
              label.name.trim().toLowerCase() ===
              searchLabel.trim().toLowerCase(),
          );
          if (!matchedLabel) {
            vscode.window.showInformationMessage(
              "Unable to locate good starter issues :(",
            );
            break;
          }

          const repoUrl = `https://www.github.com/${githubRepo.full_name}`;
          // Replace the spaces in the name of the label by + signs
          const goodFirstIssueLabel: string = matchedLabel.name.replace(
            /\s+/g,
            "+",
          );
          // Open the browser with that filter
          const uri = vscode.Uri.parse(
            `${repoUrl}/issues?q=is%3Aopen+is%3Aissue+label%3A"${goodFirstIssueLabel}"`,
          );
          vscode.env.openExternal(uri);
          break;
        }
      }
    });
  }

  public revive(panel: vscode.WebviewView) {
    this._view = panel;
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "styles", "reset.css"),
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "styles", "vscode.css"),
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "out", "compiled/scope.js"),
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "out", "compiled/scope.css"),
    );

    // Use a nonce to only allow a specific script to be run.
    const nonce = getNonce();

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
        -->
        <meta http-equiv="Content-Security-Policy" content="img-src https: data:; style-src 'unsafe-inline' ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
        <link href="${styleMainUri}" rel="stylesheet">
        <script nonce="${nonce}">
          const tsvscode = acquireVsCodeApi();
        </script>
			</head>
      <body>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }
}
