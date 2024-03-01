// Copyright (C) 2024, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "chatView";

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Enable javascript in the webview
      enableScripts: true,

      // Restrict the webview to only loading content from our extension's `media` directory.
      localResourceRoots: [this._extensionUri],
    };

    // Set the webview's html content
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Listen for events from the webview
    this._setWebviewMessageListeners(webviewView.webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Uri to load styles into webview
    const vscodeStyle = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "assets", "vscode.css"),
    );
    const resetStyle = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "assets", "reset.css"),
    );

    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="${vscodeStyle}" rel="stylesheet">
          <link href="${resetStyle}" rel="stylesheet">
          <title>Chat View</title>
      </head>
      <body>
          <div id="messages"></div>
          <div id="inputArea">
              <input type="text" id="messageInput" placeholder="Type your message here...">
              <button id="sendButton">Send</button>
          </div>        

          <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            const messagesDiv = document.getElementById('messages');
            const input = document.getElementById('messageInput');
            const sendButton = document.getElementById('sendButton');

            sendButton.onclick = () => {
                const content = input.value.trim();
                if (content) {
                    addMessage('You', content);
                    vscode.postMessage({
                        command: 'sendMessage',
                        text: content
                    });
                    input.value = ''; // Clear the input field

                    // // Simulate a reply from "Quack"
                    // setTimeout(() => {
                    //     addMessage('Quack', '...');
                    // }, 500);
                }
            };

            function addMessage(author, content) {
                const messageElement = document.createElement('div');
                messageElement.textContent = \`\${author}: \${content}\`;
                messagesDiv.appendChild(messageElement);
                messageElement.scrollIntoView();
            }
            window.addEventListener('message', event => {
              const { command, author, text } = event.data; // Destructure the message data
              switch (command) {
                case 'addMessage':
                  addMessage(author, text);
                  break;
                // Handle other commands as needed
              }
            });
        </script>
      </body>
      </html>`;
  }

  private _setWebviewMessageListeners(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "sendMessage":
            // Handle the message sending
            const responseMessage = await vscode.commands.executeCommand(
              "quack.sendChatMessage",
              message.text,
            );
            console.log(responseMessage);
            if (this._view) {
              this._view.webview.postMessage({
                command: "addMessage",
                author: "Quack",
                text: responseMessage,
              });
            }
            break;
        }
      },
      undefined,
      [],
    );
  }
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
