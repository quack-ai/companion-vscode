// Copyright (C) 2023-2024, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";

export interface GuidelineState {
  enabled: boolean;
  content: string;
}

export class GuidelineTreeItem extends vscode.TreeItem {
  public readonly contextValue = "guidelineTreeItem";
  constructor(
    public readonly guideline: GuidelineState,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    private readonly _extensionUri: vscode.Uri,
  ) {
    super(guideline.content, collapsibleState);
    this.tooltip = guideline.content;
  }
}

export class GuidelineTreeProvider
  implements vscode.TreeDataProvider<GuidelineTreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    GuidelineTreeItem | undefined | null | void
  > = new vscode.EventEmitter<GuidelineTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    GuidelineTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private _guidelines: GuidelineState[];
  private _guidelineItems: GuidelineTreeItem[] = [];
  private readonly _extensionUri: vscode.Uri;

  constructor(
    _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
  ) {
    this._guidelines = [];
    this._extensionUri = _extensionUri;
  }

  getIndexOf(item: GuidelineTreeItem) {
    return this._guidelineItems.indexOf(item);
  }

  refresh(): void {
    this._guidelines = this._context.globalState.get("quack.guidelines") || [];
    this._guidelineItems = this._guidelines.map(
      (guideline) =>
        new GuidelineTreeItem(
          guideline,
          vscode.TreeItemCollapsibleState.None,
          this._extensionUri,
        ),
    );
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: GuidelineTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(
    element?: GuidelineTreeItem,
  ): vscode.ProviderResult<GuidelineTreeItem[]> {
    if (element) {
      // If element is defined, it means vscode is asking for the children of this element.
      // In this case, return an empty array as guidelines are not hierarchical.
      return [];
    } else {
      // If element is undefined, it means vscode is asking for the root elements.
      return this._guidelineItems;
    }
  }
}
