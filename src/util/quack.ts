// Copyright (C) 2023-2024, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";
import axios, { AxiosResponse, AxiosError } from "axios";

export interface QuackGuideline {
  id: number;
  order: number;
  title: string;
  details: string;
}

export interface ComplianceResult {
  guideline_id: number;
  is_compliant: boolean;
  comment: string;
}

export interface GuidelineCompliance {
  is_compliant: boolean;
  comment: string;
  // suggestion: string;
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface StreamingMessage {
  model: string;
  created_at: string;
  message: ChatMessage;
  done: boolean;
}

export async function verifyQuackEndpoint(
  endpointURL: string,
): Promise<boolean> {
  const routeURL: string = new URL("/api/v1/repos", endpointURL).toString();
  try {
    await axios.get(routeURL);
    return false;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response && error.response.status === 401) {
        return true;
      }
    }
    return false;
  }
}

export async function verifyQuackToken(
  quackToken: string,
  endpointURL: string,
): Promise<boolean> {
  const routeURL: string = new URL("/api/v1/repos", endpointURL).toString();
  try {
    await axios.get(routeURL, {
      headers: { Authorization: `Bearer ${quackToken}` },
    });
    return true;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response && error.response.status === 403) {
        return true;
      }
    }
    return false;
  }
}

export async function getToken(
  githubToken: string,
  endpointURL: string,
): Promise<string> {
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
      throw new Error("Unable to authenticate");
    }
  } catch (error) {
    // Handle other errors that may occur during the request
    console.error("Error fetching repository details:", error);

    // Show an error message or handle the error accordingly
    vscode.window.showErrorMessage(
      "Failed to fetch repository details. Make sure the repository exists and is public.",
    );
    throw new Error("Unable to authenticate");
  }
}

export async function fetchRepoGuidelines(
  repoId: number,
  endpointURL: string,
  token: string,
): Promise<QuackGuideline[]> {
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
      throw new Error("Unable to fetch guidelines");
    }
  } catch (error) {
    // Handle other errors that may occur during the request
    console.error("Error fetching repository details:", error);

    // Show an error message or handle the error accordingly
    vscode.window.showErrorMessage(
      "Failed to fetch repository details. Make sure the repository exists and is public.",
    );
    throw new Error("Unable to fetch guidelines");
  }
}

export async function analyzeSnippet(
  repoId: number,
  code: string,
  endpointURL: string,
  token: string,
): Promise<ComplianceResult[]> {
  const quackURL = new URL(
    `/api/v1/compute/analyze/${repoId}`,
    endpointURL,
  ).toString();
  try {
    const response: AxiosResponse<any> = await axios.post(
      quackURL,
      { code: code },
      { headers: { Authorization: `Bearer ${token}` } },
    );

    // Handle the response
    if (response.status === 200) {
      return response.data;
    } else {
      // The request returned a non-200 status code (e.g., 404)
      vscode.window.showErrorMessage(
        `Quack API returned status code ${response.status}`,
      );
      throw new Error("Unable to analyze code");
    }
  } catch (error) {
    // Handle other errors that may occur during the request
    console.error("Error sending Quack API request:", error);
    vscode.window.showErrorMessage("Invalid API request.");
    throw new Error("Unable to analyze code");
  }
}

export async function checkSnippet(
  guidelineId: number,
  code: string,
  endpointURL: string,
  token: string,
): Promise<ComplianceResult> {
  const quackURL = new URL(
    `/api/v1/compute/check/${guidelineId}`,
    endpointURL,
  ).toString();
  try {
    const response: AxiosResponse<any> = await axios.post(
      quackURL,
      { code: code },
      { headers: { Authorization: `Bearer ${token}` } },
    );

    // Handle the response
    if (response.status === 200) {
      return response.data;
    } else {
      // The request returned a non-200 status code (e.g., 404)
      vscode.window.showErrorMessage(
        `Quack API returned status code ${response.status}`,
      );
      throw new Error("Unable to analyze code");
    }
  } catch (error) {
    // Handle other errors that may occur during the request
    console.error("Error sending Quack API request:", error);
    vscode.window.showErrorMessage("Invalid API request.");
    throw new Error("Unable to analyze code");
  }
}

export async function addRepoToQueue(
  repoId: number,
  endpointURL: string,
  token: string,
): Promise<null> {
  const quackURL = new URL(
    `/api/v1/repos/${repoId}/waitlist`,
    endpointURL,
  ).toString();
  try {
    const response: AxiosResponse<any> = await axios.post(
      quackURL,
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );

    // Handle the response
    if (response.status === 200) {
      return null;
    } else {
      // The request returned a non-200 status code (e.g., 404)
      vscode.window.showErrorMessage(
        `Quack API returned status code ${response.status}`,
      );
      throw new Error("Unable to add repo to waitlist");
    }
  } catch (error) {
    // Handle other errors that may occur during the request
    console.error("Error sending Quack API request:", error);
    vscode.window.showErrorMessage("Invalid API request.");
    throw new Error("Unable to add repo to waitlist");
  }
}

export async function postChatMessage(
  messages: ChatMessage[],
  endpointURL: string,
  token: string,
  onChunkReceived: (chunk: string) => void,
  onEnd: () => void,
): Promise<void> {
  const quackURL = new URL("/api/v1/code/chat", endpointURL).toString();
  try {
    const response: AxiosResponse<any> = await axios.post(
      quackURL,
      { messages: messages },
      { headers: { Authorization: `Bearer ${token}` }, responseType: "stream" },
    );
    response.data.on("data", (chunk: any) => {
      // Handle the chunk of data
      onChunkReceived(JSON.parse(chunk).message.content);
    });

    response.data.on("end", () => {
      // console.log("Stream ended");
      onEnd();
    });

    response.data.on("error", (error: Error) => {
      console.error(error);
    });
  } catch (error) {
    // Handle other errors that may occur during the request
    console.error("Error sending Quack API request:", error);
    vscode.window.showErrorMessage("Invalid API request.");
    throw new Error("Unable to send chat message");
  }
}
