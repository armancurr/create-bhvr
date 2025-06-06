#!/usr/bin/env bun
// @ts-ignore: Shebang line

import { program } from "commander";
import pc from "picocolors";
import { createProject, displayBanner } from "./utils/helpers";

program
  .name("create-comet")
  .description("Create a modern Next.js application")
  .argument("[project-directory]", "Directory to create the project in")
  .option("-y, --yes", "Skip all confirmation prompts", false)
  .action(async (projectDirectory, options) => {
    try {
      displayBanner();
      const result = await createProject(projectDirectory, options);

      if (result) {
        console.log(pc.green("\n✓ Project created successfully!"));
        console.log("\nNext steps:");
        console.log(pc.cyan(`  cd ${result.projectName}`));

        if (!result.dependenciesInstalled) {
          console.log(pc.cyan("  bun install"));
        }

        console.log(pc.cyan("  bun dev"));

        console.log("\nMake sure to:");
        console.log(
          pc.yellow("  1. Update your database connection string in"),
          pc.bold(pc.yellow(".env.local")),
        );
        console.log(
          pc.yellow("  2. Start building your API in"),
          pc.bold(pc.yellow("src/app/api")),
        );
        console.log(
          pc.yellow("  3. Create your database models in"),
          pc.bold(pc.yellow("src/models")),
        );
        process.exit(0);
      }
    } catch (err) {
      // The error is already logged in createProject, so we just exit.
      process.exit(1);
    }
  });

program.parse();
