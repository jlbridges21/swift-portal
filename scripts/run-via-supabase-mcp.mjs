import fs from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error("Usage: node scripts/run-via-supabase-mcp.mjs <path.sql>");
  process.exit(1);
}

const query = fs.readFileSync(sqlFile, "utf8");
const url = "https://mcp.supabase.com/mcp?project_ref=zdslafozynmemjifncjp&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching";

const transport = new StreamableHTTPClientTransport(new URL(url));
const client = new Client({ name: "tenant-sql-runner", version: "1.0.0" });

try {
  await client.connect(transport);
  const result = await client.callTool({ name: "execute_sql", arguments: { query } });
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error("MCP error:", err);
  process.exit(1);
} finally {
  await client.close();
}
