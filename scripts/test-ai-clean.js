#!/usr/bin/env node
/*
Simple integration script to POST a sample payload to the AI Clean endpoint.
Usage:
  PREVIEW_URL="https://73be5a5b.rangkai-book-metadata.pages.dev" COOKIE="session=..." node scripts/test-ai-clean.js
Or pass args:
  node scripts/test-ai-clean.js --url <PREVIEW_URL> --cookie "session=..."

Note: The endpoint requires an authenticated session. Provide a valid session cookie string via the COOKIE env var or --cookie flag.
*/

const { argv, env } = process;

function parseArgs() {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--url" && argv[i + 1]) {
      args.url = argv[i + 1];
      i++;
    } else if (argv[i] === "--cookie" && argv[i + 1]) {
      args.cookie = argv[i + 1];
      i++;
    }
  }
  return args;
}

(async () => {
  const args = parseArgs();
  const PREVIEW_URL = args.url || env.PREVIEW_URL;
  const COOKIE = args.cookie || env.COOKIE;

  if (!PREVIEW_URL) {
    console.error(
      "ERROR: PREVIEW URL not provided. Set PREVIEW_URL env var or pass --url.",
    );
    process.exit(2);
  }
  if (!COOKIE) {
    console.error(
      "WARNING: No cookie provided. The endpoint requires auth; request may be unauthorized.",
    );
  }

  const endpoint = PREVIEW_URL.replace(/\/$/, "") + "/api/ai/clean";

  const samplePayload = {
    isbn13: "9780132350884",
    isbn10: "0132350882",
    title: "Clean Code",
    authors: ["Robert C. Martin"],
    publisher: "Prentice Hall",
    description: "A handbook of agile software craftsmanship.",
    json_data: {},
    // optional: include scan_id if you want to test update path
    // scan_id: 1
  };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(COOKIE ? { Cookie: COOKIE } : {}),
      },
      body: JSON.stringify(samplePayload),
    });

    const text = await res.text();
    console.log("HTTP", res.status, res.statusText);
    try {
      console.log("Response JSON:", JSON.stringify(JSON.parse(text), null, 2));
    } catch (e) {
      console.log("Response Text:", text);
    }

    process.exit(res.ok ? 0 : 1);
  } catch (err) {
    console.error("Request failed:", err);
    process.exit(1);
  }
})();
