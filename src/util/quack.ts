// Copyright (C) 2023-2024, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";
import axios, { AxiosResponse, AxiosError } from "axios";

let config = vscode.workspace.getConfiguration("api");

export interface QuackGuideline {
  id: number;
  content: string;
  creator_id: number;
  created_at: string;
  updated_at: string;
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
  const routeURL: string = new URL(
    "/api/v1/login/validate",
    endpointURL,
  ).toString();
  try {
    await axios.get(routeURL);
    return true;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response && error.response.status === 401) {
        return true;
      }
    }
    return false;
  }
}

export async function getAPIAccessStatus(
  quackToken: string,
  endpointURL: string,
): Promise<string> {
  const routeURL: string = new URL(
    "/api/v1/login/validate",
    endpointURL,
  ).toString();
  try {
    await axios.get(routeURL, {
      headers: { Authorization: `Bearer ${quackToken}` },
    });
    return "ok"; // Token & endpoint good
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.code === "ECONNREFUSED") {
        return "unreachable-endpoint"; // Wrong endpoint
      } else if (error.response && error.response.status === 404) {
        return "unknown-route"; // Unknown route
      } else if (error.response && error.response.status === 401) {
        return "expired-token"; // expired
      }
    }
    return "other"; // Token or server issues
  }
}

export function checkAPIAccess(context: vscode.ExtensionContext): boolean {
  // API Checks
  if (!config.get("endpoint")) {
    vscode.window.showErrorMessage("Configure your endpoint first");
    context.globalState.update("quack.isValidEndpoint", false);
    vscode.commands.executeCommand(
      "setContext",
      "quack.isValidEndpoint",
      false,
    );
    return false;
  }
  if (!context.globalState.get("quack.quackToken")) {
    vscode.window.showErrorMessage("Authenticate first");
    context.globalState.update("quack.isValidToken", false);
    vscode.commands.executeCommand("setContext", "quack.isValidToken", false);
    return false;
  }
  return true;
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

export async function fetchGuidelines(
  endpointURL: string,
  token: string,
): Promise<QuackGuideline[]> {
  const quackURL = new URL(`/api/v1/guidelines`, endpointURL).toString();
  try {
    // Retrieve the guidelines
    const response: AxiosResponse<any> = await axios.get(quackURL, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Handle the response
    if (response.status === 200) {
      return response.data;
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

export async function postGuideline(
  content: string,
  endpointURL: string,
  token: string,
): Promise<QuackGuideline> {
  const quackURL = new URL(`/api/v1/guidelines`, endpointURL).toString();
  try {
    // Retrieve the guidelines
    const response: AxiosResponse<any> = await axios.post(
      quackURL,
      { content: content },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    // Handle the response
    if (response.status === 201) {
      return response.data;
    } else {
      vscode.window.showErrorMessage(
        `Quack API returned status code ${response.status}`,
      );
      throw new Error("Unable to create guideline");
    }
  } catch (error) {
    // Handle other errors that may occur during the request
    console.error("Error creating guideline:", error);

    // Show an error message or handle the error accordingly
    vscode.window.showErrorMessage("Failed to create guideline.");
    throw new Error("Unable to create guideline");
  }
}

export async function patchGuideline(
  id: number,
  content: string,
  endpointURL: string,
  token: string,
): Promise<QuackGuideline> {
  const quackURL = new URL(`/api/v1/guidelines/${id}`, endpointURL).toString();
  try {
    // Retrieve the guidelines
    const response: AxiosResponse<any> = await axios.patch(
      quackURL,
      { content: content },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    // Handle the response
    if (response.status === 200) {
      return response.data;
    } else {
      vscode.window.showErrorMessage(
        `Quack API returned status code ${response.status}`,
      );
      throw new Error("Unable to patch guideline");
    }
  } catch (error) {
    // Handle other errors that may occur during the request
    console.error("Error patching guideline:", error);

    // Show an error message or handle the error accordingly
    vscode.window.showErrorMessage("Failed to patch guideline.");
    throw new Error("Unable to patch guideline");
  }
}

export async function deleteGuideline(
  id: number,
  endpointURL: string,
  token: string,
): Promise<QuackGuideline> {
  const quackURL = new URL(`/api/v1/guidelines/${id}`, endpointURL).toString();
  try {
    // Retrieve the guidelines
    const response: AxiosResponse<any> = await axios.delete(quackURL, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Handle the response
    if (response.status === 200) {
      return response.data;
    } else {
      vscode.window.showErrorMessage(
        `Quack API returned status code ${response.status}`,
      );
      throw new Error("Unable to patch guideline");
    }
  } catch (error) {
    // Handle other errors that may occur during the request
    console.error("Error patching guideline:", error);

    // Show an error message or handle the error accordingly
    vscode.window.showErrorMessage("Failed to patch guideline.");
    throw new Error("Unable to patch guideline");
  }
}
