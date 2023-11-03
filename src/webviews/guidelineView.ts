// Copyright (C) 2023, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";

export interface GuidelineState {
  id: number;
  title: string;
  details: string;
  completed: boolean;
}

export class GuidelineTreeItem extends vscode.TreeItem {
  public readonly contextValue = "guidelineTreeItem";
  constructor(
    public readonly guideline: GuidelineState,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    private readonly _extensionUri: vscode.Uri,
  ) {
    super(guideline.title, collapsibleState);
    this.tooltip = guideline.details;
    this.updateIconPath();
  }

  updateIconPath(): void {
    const iconFileName = this.guideline.completed ? "pass.svg" : "error.svg";
    this.iconPath = {
      light: vscode.Uri.joinPath(
        this._extensionUri,
        "media",
        "light",
        iconFileName,
      ),
      dark: vscode.Uri.joinPath(
        this._extensionUri,
        "media",
        "dark",
        iconFileName,
      ),
    };
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
  private readonly _extensionUri: vscode.Uri;
  private _guidelineItems: GuidelineTreeItem[] = [];

  constructor(extensionUri: vscode.Uri) {
    this._guidelines = [];
    this._extensionUri = extensionUri;
  }

  refresh(guidelines: GuidelineState[]): void {
    this._guidelines = guidelines;
    this._guidelineItems = this._guidelines.map(
      (guideline) =>
        new GuidelineTreeItem(
          guideline,
          vscode.TreeItemCollapsibleState.None,
          this._extensionUri,
        ),
    );
    this._guidelineItems.forEach((item) => item.updateIconPath());
    this._onDidChangeTreeData.fire();
  }

  refreshItem(guidelineId: number, completed: boolean): void {
    let item = this._guidelineItems.find((g) => g.guideline.id === guidelineId);
    if (item) {
      item.guideline.completed = completed;
      this._guidelineItems.forEach((item) => item.updateIconPath());
      this._onDidChangeTreeData.fire();
    }
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
