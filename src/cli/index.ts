#!/usr/bin/env node

import { Command } from "commander";

const program = new Command();

program
  .name("agentrelay")
  .description(
    "Capture your AI coding agent session and continue in a different agent."
  )
  .version("0.1.0");

// --- detect ---
program
  .command("detect")
  .description("Scan for installed AI coding agents")
  .action(async () => {
    // TODO: Run detectAgents() and display results
    console.log("detect: not implemented yet");
  });

// --- list ---
program
  .command("list")
  .description("List recent sessions across detected agents")
  .option("-s, --source <agent>", "Filter by agent (claude-code, cursor, codex)")
  .option("-l, --limit <n>", "Max sessions to show", "10")
  .action(async (options) => {
    // TODO: List sessions from adapters
    console.log("list: not implemented yet");
  });

// --- capture ---
program
  .command("capture")
  .description("Capture a session into .handoff/session.json")
  .option("-s, --source <agent>", "Source agent")
  .option("--session <id>", "Specific session ID")
  .option("-p, --project <path>", "Project path")
  .action(async (options) => {
    // TODO: Capture session and write to .handoff/session.json
    console.log("capture: not implemented yet");
  });

// --- handoff ---
program
  .command("handoff")
  .description("Full pipeline: capture → compress → generate resume → deliver")
  .option("-s, --source <agent>", "Source agent")
  .option("-t, --target <target>", "Target agent or delivery method", "file")
  .option("--session <id>", "Specific session ID")
  .option("-p, --project <path>", "Project path")
  .option("--tokens <n>", "Token budget override")
  .action(async (options) => {
    // TODO: Run full handoff pipeline
    console.log("handoff: not implemented yet");
  });

// --- watch ---
program
  .command("watch")
  .description("Start background watcher for rate limit detection")
  .option("--agents <csv>", "Comma-separated list of agents to watch")
  .option("--interval <seconds>", "Snapshot interval in seconds", "30")
  .action(async (options) => {
    // TODO: Start watcher
    console.log("watch: not implemented yet");
  });

// --- resume ---
program
  .command("resume")
  .description("Re-generate resume prompt from a captured session.json")
  .option("-t, --target <agent>", "Target agent for formatting")
  .option("--tokens <n>", "Token budget override")
  .option("-f, --file <path>", "Path to session.json")
  .action(async (options) => {
    // TODO: Load session.json, compress, generate resume
    console.log("resume: not implemented yet");
  });

// --- info ---
program
  .command("info")
  .description("Show agent storage paths, context window sizes, and config")
  .action(async () => {
    // TODO: Display agent registry info
    console.log("info: not implemented yet");
  });

program.parse();
