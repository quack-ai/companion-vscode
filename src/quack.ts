import * as vscode from "vscode";
import axios, { AxiosResponse } from "axios";

export interface QuackGuideline {
  id: number;
  title: string;
  details: string;
}

export async function fetchRepoGuidelines(repoId: number): Promise<any> {
  try {
    // Retrieve the guidelines
    const response: AxiosResponse<any> = await axios.get(
      `https://backend.quack-ai.com/api/v1/repos/${repoId}/guidelines`,
    );

    // Handle the response
    if (response.status === 200) {
      // The request was successful, and you can process the response data here
      return response.data;
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
