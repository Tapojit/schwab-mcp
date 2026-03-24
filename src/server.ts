import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SchwabClient } from "./client.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources.js";

export interface ServerOptions {
  enableTechnicalTools?: boolean;
}

export class SchwabMCPServer {
  private server: McpServer;

  constructor(
    name: string,
    private readonly client: SchwabClient,
    opts: ServerOptions = {},
  ) {
    this.server = new McpServer(
      {
        name,
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          logging: {},
        },
      },
    );

    // Wire up auth failure notifications via MCP logging protocol
    this.client.setAuthFailureCallback((message: string) => {
      this.server.sendLoggingMessage({
        level: "emergency",
        logger: "schwab-auth",
        data: message,
      }).catch(() => {
        // Connection may not be ready yet; fall back to stderr
        console.error(message);
      });
    });

    registerTools(this.server, this.client, {
      enableTechnical: opts.enableTechnicalTools ?? true,
    });
    registerResources(this.server);
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

export function sendErrorResponse(
  errorMessage: string,
  code: number = 401,
  details: Record<string, unknown> = {},
): void {
  const response = {
    jsonrpc: "2.0",
    id: "pre-initialization",
    error: {
      code,
      message: errorMessage,
      data: details,
    },
  };
  process.stdout.write(JSON.stringify(response) + "\n");
  process.exit(1);
}
