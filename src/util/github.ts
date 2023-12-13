// Copyright (C) 2023, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";
import axios, { AxiosResponse } from "axios";

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
  id: string;
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

export async function getRepoDetails(repoName: string): Promise<any> {
  try {
    // Check that it's a public repo
    const response: AxiosResponse<any> = await axios.get(
      `https://api.github.com/repos/${repoName}`,
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
      return null; // or throw an error, return an empty object, etc.
    }
  } catch (error) {
    // Handle other errors that may occur during the request
    console.error("Error fetching repository details:", error);

    // Show an error message or handle the error accordingly
    vscode.window.showErrorMessage(
      "Failed to fetch repository details. Make sure the repository exists and is public.",
    );
    return null; // or throw an error, return an empty object, etc.
  }
}

export async function fetchStarterIssues(repo: GitHubRepo): Promise<any> {
  try {
    // Fetch list of labels
    // https://docs.github.com/en/rest/search/search?apiVersion=2022-11-28#search-labels
    const searchLabel = "good first issue";
    const starterQuery: string = searchLabel.replace(/\s+/g, "+");
    const ghLabels: AxiosResponse<any> = await axios.get(
      `https://api.github.com/search/labels?repository_id=${repo.id}&q=${starterQuery}`,
    );
    if (ghLabels.status !== 200) {
      // The request was successful, and you can process the response data here
      vscode.window.showErrorMessage(
        `Fetching labels from GitHub API returned status code ${ghLabels.status}`,
      );
      return null;
    }
    if (ghLabels.data.items.length === 0) {
      vscode.window.showInformationMessage("No matching issues");
      return null;
    }
    // Locate the good first issue
    const starterLabel = ghLabels.data.items.find(
      (label: Label) =>
        label.name.trim().toLowerCase() === searchLabel.trim().toLowerCase(),
    );
    if (!starterLabel) {
      vscode.window.showInformationMessage(
        "Unable to locate good starter issues :(",
      );
      return;
    }

    // Find starter issues
    const queryParams = {
      labels: starterLabel.name,
      is: "issue",
      state: "open",
      sort: "created",
      per_page: 100,
    };
    const response: AxiosResponse<any> = await axios.get(
      `https://api.github.com/repos/${repo.full_name}/issues`,
      { params: queryParams },
    );

    // Handle the response
    if (response.status === 200) {
      // The request was successful, and you can process the response data here
      return response.data;
    } else {
      // The request returned a non-200 status code (e.g., 404)
      // Show an error message or handle the error accordingly
      vscode.window.showErrorMessage(
        `GitHub API returned status code ${response.status}`,
      );
      return null; // or throw an error, return an empty object, etc.
    }
  } catch (error) {
    // Handle other errors that may occur during the request
    console.error("Error fetching repository issues:", error);

    // Show an error message or handle the error accordingly
    vscode.window.showErrorMessage(
      "Failed to fetch repository issues. Make sure the repository exists and is public.",
    );
    return null; // or throw an error, return an empty object, etc.
  }
}

export async function searchIssues(
  repoName: string,
  topic: string,
): Promise<any> {
  try {
    // Find starter issues
    const queryParams = {
      q: `${topic} repo:${repoName} is:public`,
      sort: "created",
      per_page: 100,
    };
    const response: AxiosResponse<any> = await axios.get(
      `https://api.github.com/search/issues`,
      { params: queryParams },
    );

    // Handle the response
    if (response.status === 200) {
      // The request was successful, and you can process the response data here
      return response.data.items;
    } else {
      // The request returned a non-200 status code (e.g., 404)
      // Show an error message or handle the error accordingly
      vscode.window.showErrorMessage(
        `GitHub API returned status code ${response.status}`,
      );
      return null; // or throw an error, return an empty object, etc.
    }
  } catch (error) {
    // Handle other errors that may occur during the request
    console.error("Error fetching repository issues:", error);

    // Show an error message or handle the error accordingly
    vscode.window.showErrorMessage(
      "Failed to fetch repository issues. Make sure the repository exists and is public.",
    );
    return null; // or throw an error, return an empty object, etc.
  }
}
