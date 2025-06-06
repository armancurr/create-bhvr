import figlet from "figlet";
import pc from "picocolors";
import { execa } from "execa";
import ora from "ora";
import path from "node:path";
import { mkdir, rm } from "node:fs/promises";
import type { ProjectOptions, ProjectResult } from "../types";
import prompts from "prompts";

// --- Display Functions ---

export function displayBanner() {
  try {
    const text = figlet.textSync("comet", { font: "Rowan Cap" });
    console.log("\n" + pc.yellowBright(text));
  } catch (error) {
    console.log(
      "\n" + pc.yellowBright("comet") + "\n" + pc.yellow("==========="),
    );
  }
}

function logError(message: string, error?: unknown) {
  console.error(pc.red(`\nError: ${message}`));
  if (error instanceof Error) {
    console.error(pc.gray(error.message));
  }
}

// --- File System Utilities (using Bun's fast APIs) ---

async function pathExists(filePath: string): Promise<boolean> {
  return await Bun.file(filePath).exists();
}

async function ensureDir(dirPath: string): Promise<void> {
  // Using Node's fs/promises is fine here. It's reliable and cross-platform.
  await mkdir(dirPath, { recursive: true });
}

async function emptyDir(dirPath: string): Promise<void> {
  await rm(dirPath, { recursive: true, force: true });
  await ensureDir(dirPath);
}

// --- Core Scaffolding Logic ---

async function copyTemplate(
  templatePath: string,
  projectPath: string,
  projectName: string,
): Promise<void> {
  const spinner = ora("Setting up project files...").start();

  try {
    const templateFiles = await Array.fromAsync(
      new Bun.Glob("**/*").scan({ cwd: templatePath, dot: true }),
    );

    for (const file of templateFiles) {
      const sourcePath = path.join(templatePath, file);
      const destPath = path.join(projectPath, file);

      // Ensure parent directory exists before writing file
      await ensureDir(path.dirname(destPath));

      const sourceFile = Bun.file(sourcePath);

      // More robust: handle package.json as an object, not a string
      if (file === "package.json") {
        const pkgContent = await sourceFile.json();
        pkgContent.name = projectName;
        await Bun.write(destPath, JSON.stringify(pkgContent, null, 2));
      } else {
        // Bun.write can take a BunFile directly for ultra-fast copying
        await Bun.write(destPath, sourceFile);
      }
    }

    spinner.succeed("Project files set up successfully.");
  } catch (err) {
    spinner.fail("Failed to copy template files.");
    throw err; // Propagate error to be caught by the main handler
  }
}

async function initializeGit(projectPath: string): Promise<boolean> {
  const spinner = ora("Initializing git repository...").start();
  try {
    await execa("git", ["init"], { cwd: projectPath });
    spinner.succeed("Git repository initialized.");
    return true;
  } catch (err) {
    spinner.fail("Failed to initialize git. Is git installed?");
    logError("Could not initialize git repository.", err);
    return false;
  }
}

async function installDependencies(projectPath: string): Promise<boolean> {
  const spinner = ora("Installing dependencies with bun...").start();
  try {
    await execa("bun", ["install"], { cwd: projectPath });
    spinner.succeed("Dependencies installed.");
    return true;
  } catch (err) {
    spinner.fail("Failed to install dependencies.");
    logError("Dependency installation failed.", err);
    console.log(pc.yellow("You can try running 'bun install' manually."));
    return false;
  }
}

// --- Main Exported Function ---

export async function createProject(
  projectDirectory: string,
  options: ProjectOptions,
): Promise<ProjectResult | null> {
  let projectName = projectDirectory;

  // 1. Determine Project Name
  if (!projectName) {
    if (options.yes) {
      projectName = "comet-app";
    } else {
      const response = await prompts({
        type: "text",
        name: "value",
        message: "What is the path to your new project?",
        initial: "comet-app",
      });
      if (!response.value) return null; // User cancelled
      projectName = response.value;
    }
  }

  const projectPath = path.resolve(process.cwd(), projectName);

  // 2. Check and Prepare Directory
  if (await pathExists(projectPath)) {
    const isDirectoryEmpty =
      (await Array.fromAsync(new Bun.Glob("*").scan(projectPath))).length === 0;
    if (!isDirectoryEmpty && !options.yes) {
      const { value: overwrite } = await prompts({
        type: "confirm",
        name: "value",
        message: `Directory "${projectName}" is not empty. Overwrite it?`,
        initial: false,
      });
      if (!overwrite) return null; // User cancelled
      await emptyDir(projectPath);
    }
  }
  await ensureDir(projectPath);

  // 3. Copy Template Files
  try {
    // CRITICAL FIX: Use `import.meta.dir` instead of `__dirname`
    // This assumes your structure is:
    // - root/
    //   - src/
    //     - utils/
    //       - helpers.ts  <-- import.meta.dir points here
    //   - templates/
    //     - default/
    const templatePath = path.join(
      import.meta.dir,
      "utils",
      "templates",
      "default",
    );
    await copyTemplate(templatePath, projectPath, projectName);
  } catch (err) {
    logError("Could not create project from template.", err);
    return null;
  }

  // 4. Initialize Git (if requested)
  let gitInitialized = false;
  if (
    options.yes ||
    (
      await prompts({
        type: "confirm",
        name: "value",
        message: "Initialize a git repository?",
        initial: true,
      })
    ).value
  ) {
    gitInitialized = await initializeGit(projectPath);
  }

  // 5. Install Dependencies (if requested)
  let dependenciesInstalled = false;
  if (
    options.yes ||
    (
      await prompts({
        type: "confirm",
        name: "value",
        message: "Install dependencies?",
        initial: true,
      })
    ).value
  ) {
    dependenciesInstalled = await installDependencies(projectPath);
  }

  return {
    projectName,
    gitInitialized,
    dependenciesInstalled,
    template: "default",
  };
}
