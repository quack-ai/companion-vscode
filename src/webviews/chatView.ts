// Copyright (C) 2024, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";
import { ChatMessage } from "../util/quack";
import { marked } from "marked";

const roleMap = { user: "You", assistant: "Quack" };
let config = vscode.workspace.getConfiguration("ui");

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "chatView";

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Enable javascript in the webview
      enableScripts: true,
      // Restrict the webview to only loading content from our extension's `media` directory.
      localResourceRoots: [this._extensionUri],
    };

    this.initializeWebViewContent();
    // Listen for events from the webview
    this._setWebviewMessageListeners(webviewView.webview);
    // Refresh when the user comes back to this webview
    this._view.onDidChangeVisibility(() => {
      if (this._view?.visible) {
        this.refresh();
      }
    });
  }
  private initializeWebViewContent() {
    if (!this._view) {
      return;
    }
    // Set the webview's html content
    this._view.webview.html = this._getHtmlForWebview(this._view.webview);
    // Load and display previous messages
    const messages: ChatMessage[] =
      this._context.workspaceState.get<ChatMessage[]>("messages") || [];
    this._view.webview.postMessage({ command: "clearMessages" });
    messages.forEach((message) => {
      // @ts-ignore
      this._view.webview.postMessage({
        command: "addMessage",
        // @ts-ignore
        user: roleMap[message.role],
        text: marked.parse(message.content),
      });
    });
  }

  public refresh() {
    this.initializeWebViewContent();
  }
  public addChunkToLastMessage(content: string) {
    if (!this._view) {
      return;
    }
    this._view.webview.postMessage({
      command: "addChunk",
      text: content,
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Uri to load styles into webview
    const vscodeStyle = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "assets", "vscode.css"),
    );
    const resetStyle = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "assets", "reset.css"),
    );
    // Highlight theme selection (cf. https://highlightjs.org/demo)
    const highlightThemeName = config.get("highlighttheme") as string;

    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="${vscodeStyle}" rel="stylesheet">
          <link href="${resetStyle}" rel="stylesheet">
          <link href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/${highlightThemeName}.min.css" rel="stylesheet">
          <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
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
                }
            };

            function addMessage(content, user) {
              const messageElement = document.createElement('div');
              messageElement.className = 'message';
              messageElement.innerHTML = \`<strong>\${user}:</strong> \${content}\`;
              messagesDiv.appendChild(messageElement);
              hljs.highlightBlock(messageElement.querySelector('code'));
              messageElement.scrollIntoView();
            }
            function addChunk(content) {
              const messageElement = messagesDiv.lastChild;
              if (messageElement){
                messageElement.innerHTML += content;
                messageElement.scrollIntoView();
              }
            }
            window.addEventListener('message', event => {
              const msg = event.data; // Destructure the message data
              switch (msg.command) {
                case 'clearMessages':
                  document.getElementById('messages').innerHTML = '';
                  break;
                case 'addMessage':
                  addMessage(msg.text, msg.user);
                  break;
                case 'addChunk':
                  addChunk(msg.text);
                  break;
              }
            });
            document.addEventListener('DOMContentLoaded', (event) => {
              document.querySelectorAll('pre code').forEach((block) => {
                  hljs.highlightBlock(block);
              });
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
            await vscode.commands.executeCommand(
              "quack.sendChatMessage",
              message.text,
            );
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
