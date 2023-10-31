// Copyright (C) 2023, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";
import axios, { AxiosResponse } from "axios";

export interface QuackGuideline {
  id: number;
  order: number;
  title: string;
  details: string;
}

export async function verifyQuackEndpoint(
  endpointURL: string,
): Promise<boolean> {
  try {
    // Check the swagger
    const swaggerURL: string = new URL("/docs", endpointURL).toString();
    const response: AxiosResponse<any> = await axios.head(swaggerURL);
    // Handle the response
    if (response.status === 200) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
}

export async function fetchRepoGuidelines(
  repoId: number,
  endpointURL: string,
  token: string,
): Promise<any> {
  const quackURL = new URL(
    `/api/v1/repos/${repoId}/guidelines`,
    endpointURL,
  ).toString();
  try {
    // Retrieve the guidelines
    const response: AxiosResponse<any> = await axios.get(quackURL, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Handle the response
    if (response.status === 200) {
      return response.data.sort(
        (a: QuackGuideline, b: QuackGuideline) => a.order - b.order,
      );
    } else {
      // The request returned a non-200 status code (e.g., 404)
      // Show an error message or handle the error accordingly
      vscode.window.showErrorMessage(
        `Quack API returned status code ${response.status}`,
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

export async function authenticate(
  githubToken: string,
  endpointURL: string,
): Promise<any> {
  const quackURL = new URL("/api/v1/login/token", endpointURL).toString();
  try {
    // Retrieve the guidelines
    const response: AxiosResponse<any> = await axios.post(quackURL, {
      github_token: githubToken,
    });

    // Handle the response
    if (response.status === 200) {
      return response.data.access_token;
    } else {
      // The request returned a non-200 status code (e.g., 404)
      // Show an error message or handle the error accordingly
      vscode.window.showErrorMessage(
        `Quack API returned status code ${response.status}`,
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
