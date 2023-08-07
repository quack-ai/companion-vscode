// Copyright (C) 2023, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";
import { PostHog } from "posthog-node";
import * as path from "path";
import * as dotenv from "dotenv";

let telemetryClient: PostHog | null = null;
const telemetryLevel: string = vscode.workspace
  .getConfiguration("telemetry")
  .get("telemetryLevel", "all");

// Env variables
const envPath = path.join(path.dirname(__dirname), ".env");
dotenv.config({ path: envPath });

if (process.env.POSTHOG_KEY && telemetryLevel === "all") {
  telemetryClient = new PostHog(process.env.POSTHOG_KEY, {
    host: process.env.POSTHOG_HOST,
  });
  console.log("Collecting anonymized usage data");
}

export default telemetryClient;
