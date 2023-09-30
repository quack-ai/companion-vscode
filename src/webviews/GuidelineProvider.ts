// Copyright (C) 2023, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";

interface Label {
  id: number;
  name: string;
}

export interface GuidelineState {
  id: number;
  title: string;
  details: string;
  completed: boolean;
}

export class GuidelineProvider implements vscode.WebviewViewProvider {
  private _guidelines: GuidelineState[];
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {
    this._guidelines = [];
  }

  resolveWebviewView(
    panel: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = panel;
    // Set the webview options
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    // And set the html of the webview's content
    panel.webview.html = this._getHtmlForWebview(panel.webview);
  }

  public refresh(guidelines: GuidelineState[]) {
    this._guidelines = guidelines;
    if (this._view && this._view.webview) {
      this._view.webview.html = this._getHtmlForWebview(this._view.webview);
    }
  }

  private _getHtmlForWebview(panel: vscode.Webview): string {
    const titlesHtml = this._guidelines
      .map(
        (item) => `
        <li title="${item.details}">
            <input type="checkbox" ${
              item.completed ? "checked" : ""
            } disabled> ${item.title}
        </li>
    `,
      )
      .join("");

    return `
          <!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Guidelines</title>
              <style>
                ul {
                    padding-left: 0; /* Removes padding */
                    list-style-type: none; /* Removes bullet points */
                }
                li {
                    margin: 0; /* Removes margin */
                }
              </style>
          </head>
          <body>
              <ul>
                  ${titlesHtml}
              </ul>
          </body>
          </html>
      `;
  }
}
