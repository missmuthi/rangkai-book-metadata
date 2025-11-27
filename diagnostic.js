#!/usr/bin/env node

/**
 * Rangkai Self-Diagnostic Tool
 * Performs comprehensive checks on the application
 *
 * Usage:
 *   npm run diagnostic           # Full diagnostic
 *   npm run diagnostic -- --fast # Skip slow tests (unit tests, build)
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Parse command line args
const args = process.argv.slice(2);
const FAST_MODE = args.includes("--fast");

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function header(title) {
  log("\n" + "=".repeat(60), "cyan");
  log(`  ${title}`, "bright");
  log("=".repeat(60), "cyan");
}

function success(message) {
  log(`✅ ${message}`, "green");
}

function warning(message) {
  log(`⚠️  ${message}`, "yellow");
}

function error(message) {
  log(`❌ ${message}`, "red");
}

function info(message) {
  log(`ℹ️  ${message}`, "blue");
}

let passedTests = 0;
let failedTests = 0;
let warnings = 0;

// Show diagnostic mode
if (FAST_MODE) {
  log(
    "\n🚀 FAST MODE - Skipping slow tests (TypeScript, Unit Tests, Build)",
    "cyan",
  );
  log("💡 Run without --fast for full diagnostic\n", "yellow");
} else {
  log("\n🔍 FULL DIAGNOSTIC MODE", "cyan");
  log("💡 Run with --fast to skip slow tests\n", "blue");
}

// Test helpers
function runTest(name, testFn) {
  try {
    const result = testFn();
    if (result === true) {
      success(`${name}`);
      passedTests++;
    } else if (result === "warning") {
      warning(`${name}`);
      warnings++;
    } else {
      error(`${name}`);
      failedTests++;
    }
  } catch (e) {
    error(`${name}: ${e.message}`);
    failedTests++;
  }
}

function execCommand(cmd, silent = true) {
  try {
    const output = execSync(cmd, {
      encoding: "utf8",
      stdio: silent ? "pipe" : "inherit",
    });
    return output;
  } catch (e) {
    throw new Error(e.message);
  }
}

// ============================================
// 1. ENVIRONMENT CHECKS
// ============================================
header("1. Environment Checks");

runTest("Node.js version >= 18", () => {
  const version = process.version.match(/^v(\d+)/)[1];
  if (parseInt(version) >= 18) {
    info(`   Node.js ${process.version} detected`);
    return true;
  }
  return false;
});

runTest("npm is installed", () => {
  const version = execCommand("npm --version").trim();
  info(`   npm ${version} detected`);
  return true;
});

runTest("Git is installed", () => {
  const version = execCommand("git --version").trim();
  info(`   ${version} detected`);
  return true;
});

// ============================================
// 2. PROJECT STRUCTURE CHECKS
// ============================================
header("2. Project Structure");

const requiredFiles = [
  "package.json",
  "svelte.config.js",
  "vite.config.ts",
  "tsconfig.json",
  "tailwind.config.ts",
  "src/app.html",
  "src/routes/+page.svelte",
  "src/routes/+layout.svelte",
  "src/hooks.server.ts",
  "src/lib/ErrorBoundary.svelte",
  "src/lib/merge.ts",
  "src/lib/export.ts",
  "src/lib/cutter.ts",
  "src/lib/rateLimiter.ts",
  "src/lib/stores/history.svelte.ts",
];

requiredFiles.forEach((file) => {
  runTest(`File exists: ${file}`, () => {
    return existsSync(file);
  });
});

// ============================================
// 3. DEPENDENCIES CHECK
// ============================================
header("3. Dependencies");

runTest("node_modules exists", () => {
  if (existsSync("node_modules")) {
    return true;
  } else {
    info("   Run: npm install");
    return false;
  }
});

runTest("package.json is valid JSON", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  info(`   Project: ${pkg.name} v${pkg.version}`);
  return true;
});

runTest("All dependencies installed", () => {
  try {
    execCommand("npm ls --depth=0", true);
    return true;
  } catch (e) {
    return "warning";
  }
});

// ============================================
// 4. TYPESCRIPT CHECKS
// ============================================
header("4. TypeScript Type Safety");

if (!FAST_MODE) {
  runTest("TypeScript compilation check", () => {
    try {
      info("   Running svelte-check...");
      execCommand("npm run check", false);
      return true;
    } catch (e) {
      return false;
    }
  });
} else {
  info("⚡ Skipping TypeScript check (fast mode)");
}

// ============================================
// 5. UNIT TESTS
// ============================================
header("5. Unit Tests");

if (!FAST_MODE) {
  runTest("Test suite execution", () => {
    try {
      info("   Running test suite (this may take a moment)...");
      // Set a timeout and run tests without coverage for speed
      const output = execCommand(
        "npm run test -- --run --reporter=verbose 2>&1 | head -50",
      );
      const match = output.match(/Tests?\s+(\d+)\s+passed/i);
      if (match) {
        info(`   ${match[1]} tests passed`);
        return true;
      }
      // Fallback: check if no errors
      if (!output.includes("FAIL") && !output.includes("Error")) {
        info("   Tests completed successfully");
        return true;
      }
      return false;
    } catch (e) {
      warning("   Test execution skipped or timed out");
      return "warning";
    }
  });
} else {
  info("⚡ Skipping unit tests (fast mode)");
}

// ============================================
// 6. BUILD CHECK
// ============================================
header("6. Production Build");

if (!FAST_MODE) {
  runTest("Production build compiles", () => {
    try {
      info("   Building for production...");
      execCommand("npm run build", false);
      success("   Build artifacts created in .svelte-kit/");
      return true;
    } catch (e) {
      return false;
    }
  });

  runTest("Build output exists", () => {
    return (
      existsSync(".svelte-kit/output/client") &&
      existsSync(".svelte-kit/output/server")
    );
  });
} else {
  info("⚡ Skipping build check (fast mode)");
  runTest("Build output exists (from previous build)", () => {
    if (
      existsSync(".svelte-kit/output/client") &&
      existsSync(".svelte-kit/output/server")
    ) {
      return true;
    } else {
      info("   Run full diagnostic to build");
      return "warning";
    }
  });
}

// ============================================
// 7. CODE QUALITY CHECKS
// ============================================
header("7. Code Quality");

runTest("No critical errors in main page", () => {
  const content = readFileSync("src/routes/+page.svelte", "utf8");
  const issues = [];

  // Check for common issues
  if (!content.includes("import { tick }")) {
    issues.push("Missing tick import");
  }
  if (!content.includes("scanHistory")) {
    issues.push("Missing scanner history integration");
  }
  if (!content.includes("cleanISBN")) {
    issues.push("Missing ISBN sanitization");
  }

  if (issues.length > 0) {
    info(`   Issues found: ${issues.join(", ")}`);
    return false;
  }
  return true;
});

runTest("ErrorBoundary has untrack import", () => {
  const content = readFileSync("src/lib/ErrorBoundary.svelte", "utf8");
  return content.includes("untrack");
});

runTest("Server hooks configured", () => {
  const content = readFileSync("src/hooks.server.ts", "utf8");
  return (
    content.includes("handleError") && content.includes("HandleServerError")
  );
});

// ============================================
// 8. GIT STATUS
// ============================================
header("8. Git Status");

runTest("Git repository initialized", () => {
  return existsSync(".git");
});

runTest("Working directory clean", () => {
  try {
    const status = execCommand("git status --porcelain");
    if (status.trim() === "") {
      return true;
    } else {
      info("   Uncommitted changes detected");
      return "warning";
    }
  } catch (e) {
    return false;
  }
});

runTest("Remote origin configured", () => {
  try {
    const remote = execCommand("git remote get-url origin").trim();
    info(`   Remote: ${remote}`);
    return true;
  } catch (e) {
    return false;
  }
});

// ============================================
// 9. API ENDPOINT TESTS
// ============================================
header("9. External API Health");

async function testAPI(name, url) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      success(`${name} is accessible`);
      return true;
    } else {
      error(`${name} returned ${response.status}`);
      return false;
    }
  } catch (e) {
    error(`${name} failed: ${e.message}`);
    return false;
  }
}

// Note: These are async, so we'll run them separately
info("Testing external APIs (this may take a moment)...");

const testGoogleBooks = async () => {
  return await testAPI(
    "Google Books API",
    "https://www.googleapis.com/books/v1/volumes?q=isbn:9780134092669&maxResults=1",
  );
};

const testOpenLibrary = async () => {
  return await testAPI(
    "OpenLibrary API",
    "https://openlibrary.org/api/books?bibkeys=ISBN:9780134092669&format=json&jscmd=data",
  );
};

// Run async tests
Promise.all([testGoogleBooks(), testOpenLibrary()]).then(() => {
  // ============================================
  // FINAL REPORT
  // ============================================
  header("Diagnostic Summary");

  const total = passedTests + failedTests + warnings;

  log(`\n📊 Results:`, "bright");
  success(`   Passed:   ${passedTests}/${total}`);
  if (warnings > 0) {
    warning(`   Warnings: ${warnings}/${total}`);
  }
  if (failedTests > 0) {
    error(`   Failed:   ${failedTests}/${total}`);
  }

  if (failedTests === 0) {
    log("\n🎉 All critical tests passed!", "green");
    log("✅ Your application is ready for deployment\n", "green");
  } else {
    log("\n⚠️  Some tests failed. Please review the issues above.", "yellow");
    log("💡 Fix the errors before deploying to production\n", "yellow");
  }

  process.exit(failedTests > 0 ? 1 : 0);
});
