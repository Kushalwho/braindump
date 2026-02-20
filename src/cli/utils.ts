import { existsSync, lstatSync } from "node:fs";
import { dirname, join } from "node:path";
import chalk from "chalk";
import boxen from "boxen";
import type { AgentId } from "../types/index.js";

/**
 * Resolve the output path for RESUME.md.
 * - If path is a directory or ends with `/`, write RESUME.md inside it.
 * - Otherwise treat as a file path.
 */
export function resolveOutputPath(
  outputFlag: string | undefined,
  projectPath: string
): { resumePath: string; sessionDir: string } {
  if (!outputFlag) {
    const handoffDir = join(projectPath, ".handoff");
    return { resumePath: join(handoffDir, "RESUME.md"), sessionDir: handoffDir };
  }

  const isDir =
    outputFlag.endsWith("/") ||
    outputFlag.endsWith("\\") ||
    (existsSync(outputFlag) && lstatSync(outputFlag).isDirectory());

  if (isDir) {
    return { resumePath: join(outputFlag, "RESUME.md"), sessionDir: outputFlag };
  }

  return { resumePath: outputFlag, sessionDir: dirname(outputFlag) };
}

/**
 * Convert an ISO timestamp to a human-friendly relative time string.
 */
export function relativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;

  if (Number.isNaN(then)) return "unknown";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;  // "min" works for both singular and plural

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hr" : "hrs"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/**
 * Wrap content in a green-bordered box (success).
 */
export function formatBox(content: string): string {
  return boxen(content, {
    padding: 1,
    borderColor: "green",
    borderStyle: "round",
  });
}

/**
 * Wrap content in a red-bordered box (error).
 */
export function formatErrorBox(content: string): string {
  return boxen(content, {
    padding: 1,
    borderColor: "red",
    borderStyle: "round",
  });
}

/**
 * Format a dimmed hint line.
 */
export function hint(text: string): string {
  return chalk.dim(`Hint: ${text}`);
}

// --- Purple Reign color palette ---

export const colors = {
  primary: chalk.hex("#8B5CF6"),
  primaryBold: chalk.hex("#8B5CF6").bold,
  accent: chalk.blueBright,
  success: chalk.green,
  error: chalk.red,
  secondary: chalk.dim,
};

/**
 * Interpolate between two RGB colors.
 */
function lerpRgb(
  from: [number, number, number],
  to: [number, number, number],
  t: number
): [number, number, number] {
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t),
  ];
}

const ASCII_LINES = [
  "    __               _           __",
  "   / /_  _________ _(_)___  ____/ /_  ______ ___  ____",
  "  / __ \\/ ___/ __ `/ / __ \\/ __  / / / / __ `__ \\/ __ \\",
  " / /_/ / /  / /_/ / / / / / /_/ / /_/ / / / / / / /_/ /",
  "/_.___/_/   \\__,_/_/_/ /_/\\__,_/\\__,_/_/ /_/ /_/ .___/",
  "                                               /_/",
];

/**
 * Return the ASCII logo with a violet → blue gradient.
 */
export function gradientLogo(): string {
  const violet: [number, number, number] = [139, 92, 246]; // #8B5CF6
  const blue: [number, number, number] = [59, 130, 246];   // #3B82F6
  const total = ASCII_LINES.length - 1;

  return ASCII_LINES.map((line, i) => {
    const t = total > 0 ? i / total : 0;
    const [r, g, b] = lerpRgb(violet, blue, t);
    return chalk.rgb(r, g, b)(line);
  }).join("\n");
}

/**
 * Return the CLI banner string.
 */
export function banner(version: string): string {
  return [
    "",
    `  ${colors.primaryBold("braindump")} ${chalk.dim(`v${version}`)}`,
    `  ${chalk.dim("Seamless AI agent handoffs")}`,
    "",
  ].join("\n");
}

/**
 * Return the ASCII art intro screen shown when braindump is run with no args (non-TTY).
 */
export function intro(): string {
  return [
    "",
    gradientLogo(),
    "",
    `  ${chalk.dim("Seamless AI agent handoffs.")}`,
    "",
    `  ${chalk.dim("-")} GitHub   ${colors.primary("https://github.com/Kushalwho/braindump")}`,
    "",
    `  ${chalk.dim("Get started:")}`,
    `    ${chalk.bold("braindump handoff")}      Capture & generate RESUME.md`,
    `    ${chalk.bold("braindump detect")}       Scan for installed AI agents`,
    `    ${chalk.bold("braindump list")}         List recent sessions`,
    `    ${chalk.bold("braindump --help")}       Show all commands`,
    "",
  ].join("\n");
}

// --- Agent Dashboard ---

export interface AgentDashboardEntry {
  agentId: AgentId;
  name: string;
  detected: boolean;
  sessionCount: number;
  lastActiveAt?: string;
}

/**
 * Render a compact agent dashboard showing status, session count, and recency.
 */
export function agentDashboard(entries: AgentDashboardEntry[]): string {
  const lines: string[] = ["", `  ${colors.primaryBold("Agents")}`];

  // Pad agent names to align columns
  const maxNameLen = Math.max(...entries.map((e) => e.name.length));

  for (const entry of entries) {
    const padded = entry.name.padEnd(maxNameLen);
    if (entry.sessionCount > 0) {
      const countStr = colors.primary(
        `${entry.sessionCount} ${entry.sessionCount === 1 ? "session" : "sessions"}`
      );
      const timeStr = entry.lastActiveAt
        ? chalk.dim(relativeTime(entry.lastActiveAt))
        : "";
      lines.push(
        `  ${chalk.green("\u25CF")} ${chalk.white(padded)}   ${countStr}   ${timeStr}`
      );
    } else if (entry.detected) {
      lines.push(
        `  ${chalk.dim("\u25CB")} ${chalk.dim(padded)}   ${chalk.dim("installed")}`
      );
    } else {
      lines.push(
        `  ${chalk.red("\u00D7")} ${chalk.dim(padded)}   ${chalk.dim("not found")}`
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}

// --- Styled Help ---

/**
 * Custom styled help output with gradient logo and purple theme.
 */
export function styledHelp(
  version: string,
  commands: Array<{ name: string; description: string }>,
): string {
  const lines: string[] = [
    "",
    gradientLogo(),
    "",
    `  braindump v${version} ${chalk.dim("|")} ${chalk.dim("Seamless AI agent handoffs")}`,
    "",
    `  ${colors.primaryBold("USAGE")}`,
    "",
    `    ${chalk.white("$ braindump")}                    ${chalk.dim("Interactive TUI")}`,
    `    ${chalk.white("$ braindump <command>")}           ${chalk.dim("Run a specific command")}`,
    `    ${chalk.white("$ braindump <command> --help")}    ${chalk.dim("Command-specific help")}`,
    "",
    `  ${colors.primaryBold("COMMANDS")}`,
    "",
  ];

  const maxCmdLen = Math.max(...commands.map((c) => c.name.length));
  for (const cmd of commands) {
    const padded = cmd.name.padEnd(maxCmdLen + 2);
    lines.push(`    ${colors.primary(padded)} ${chalk.dim(cmd.description)}`);
  }

  lines.push("");
  lines.push(`  ${colors.primaryBold("OPTIONS")}`);
  lines.push("");
  lines.push(`    ${colors.primary("--help, -h")}      ${chalk.dim("Show help")}`);
  lines.push(`    ${colors.primary("--version, -V")}   ${chalk.dim("Show version")}`);
  lines.push("");

  return lines.join("\n");
}
