// Copyright (C) 2023, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";
import { PostHog } from "posthog-node";

let analyticsClient: PostHog | null = null;
const telemetryLevel: string = vscode.workspace
  .getConfiguration("telemetry")
  .get("telemetryLevel", "all");

// Env variables
let config = vscode.workspace.getConfiguration("analytics");

if (
  config.get("key") &&
  vscode.env.isTelemetryEnabled &&
  telemetryLevel === "all"
) {
  analyticsClient = new PostHog(config.get("key") as string, {
    host: config.get("host") || "https://app.posthog.com",
  });
  console.log("Collecting anonymized usage data");
}

export default analyticsClient;
