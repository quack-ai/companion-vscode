// Copyright (C) 2023, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";
import axios, { AxiosResponse } from "axios";
import { getCurrentRepoName } from "./session";

interface Label {
  id: number;
  name: string;
}

export interface GitHubRepo {
  id: number;
  full_name: string;
}

export interface GithubIssue {
  id: number;
  title: string;
  body: string;
  html_url: string;
  created_at: string;
}

interface GithubUser {
  id: number;
  login: string;
}

export async function getUser(githubtoken: string): Promise<GithubUser> {
  try {
    // Check that it's a public repo
    const response: AxiosResponse<any> = await axios.get(
      `https://api.github.com/user`,
      {
        headers: { Authorization: `Bearer ${githubtoken}` },
      },
    );

    // Handle the response
    if (response.status === 200) {
      return response.data;
    } else {
      // The request returned a non-200 status code (e.g., 404)
      // Show an error message or handle the error accordingly
      vscode.window.showErrorMessage(
        `GitHub API returned status code ${response.status}`,
      );
      throw new Error("Failed GitHub API call.");
    }
  } catch (error) {
    // Handle other errors that may occur during the request
    console.error("Error fetching repository details:", error);

    // Show an error message or handle the error accordingly
    vscode.window.showErrorMessage(
      "Failed to fetch repository details. Make sure the repository exists and is public.",
    );
    throw new Error("Failed GitHub API call.");
  }
}

export async function getRepoDetails(
  repoName: string,
  githubToken: string,
): Promise<GitHubRepo> {
  try {
    // Check that it's a public repo
    const response: AxiosResponse<any> = await axios.get(
      `https://api.github.com/repos/${repoName}`,
      { headers: { Authorization: `Bearer ${githubToken}` } },
    );

    // Handle the response
    if (response.status === 200) {
      return response.data;
    } else {
      throw new Error(`GitHub API returned status code ${response.status}`);
    }
  } catch (error) {
    // Handle other errors that may occur during the request
    console.error("Error fetching repository details:", error);

    // Show an error message or handle the error accordingly
    vscode.window.showErrorMessage(
      "Failed to fetch repository details. Make sure the repository exists and is public.",
    );
    throw new Error("Error fetching repository details:");
  }
}


export async function getGithubToken(
  context: vscode.ExtensionContext,
): Promise<string> {
  // Check if it's in cache
  let cachedToken: string | undefined = context.globalState.get(
    "quack-companion.githubToken",
  );
  if (cachedToken) {
    return cachedToken;
  } else {
    const session = await vscode.authentication.getSession(
      "github",
      ["read:user"],
      { createIfNone: true },
    );
    context.globalState.update(
      "quack-companion.githubToken",
      session.accessToken,
    );
    return session.accessToken;
  }
}

export async function getGithubUserId(
  context: vscode.ExtensionContext,
): Promise<string> {
  // Check if it's in cache
  let cachedId: string | undefined = context.globalState.get(
    "quack-companion.githubUserId",
  );
  if (cachedId) {
    return cachedId;
  } else {
    const user = await getUser(await getGithubToken(context));
    await context.globalState.update(
      "quack-companion.githubUserId",
      user.id.toString(),
    );
    return user.id.toString();
  }
}

export async function getActiveGithubRepo(
  context: vscode.ExtensionContext,
): Promise<GitHubRepo> {
  // Check if it's in cache
  let cachedRepo: GitHubRepo | undefined = context.workspaceState.get(
    "quack-companion.githubRepo",
  );
  if (cachedRepo) {
    return cachedRepo;
  } else {
    const repo = await getRepoDetails(
      await getCurrentRepoName(),
      await getGithubToken(context),
    );
    await context.workspaceState.update("quack-companion.githubRepo", repo);
    return repo;
  }
}
