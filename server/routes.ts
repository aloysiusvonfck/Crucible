import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import https from "node:https";

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/chat", async (req: Request, res: Response) => {
    try {
      const { messages, apiKey } = req.body;
      const key = apiKey || process.env.NVIDIA_NIM_API_KEY;

      if (!key) {
        return res.status(400).json({ error: "No API key configured" });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const payload = JSON.stringify({
        model: "nvidia/nemotron-4-340b-instruct",
        messages,
        stream: true,
        max_tokens: 4096,
        temperature: 0.7,
      });

      const options = {
        hostname: "integrate.api.nvidia.com",
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          Accept: "text/event-stream",
        },
      };

      const proxyReq = https.request(options, (proxyRes) => {
        let buffer = "";

        proxyRes.on("data", (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              res.write("data: [DONE]\n\n");
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch {}
          }
        });

        proxyRes.on("end", () => {
          if (buffer.trim()) {
            const lines = buffer.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || "";
                if (content) {
                  res.write(`data: ${JSON.stringify({ content })}\n\n`);
                }
              } catch {}
            }
          }
          res.write("data: [DONE]\n\n");
          res.end();
        });

        proxyRes.on("error", (err) => {
          console.error("Proxy response error:", err);
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.end();
        });
      });

      proxyReq.on("error", (err) => {
        console.error("Proxy request error:", err);
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      });

      proxyReq.write(payload);
      proxyReq.end();
    } catch (err: any) {
      console.error("Chat error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    }
  });

  app.post("/api/generate-module", async (req: Request, res: Response) => {
    try {
      const { code, apiKey } = req.body;
      const key = apiKey || process.env.NVIDIA_NIM_API_KEY;

      if (!key) {
        return res.status(400).json({ error: "No API key configured" });
      }

      const systemPrompt = `You are an expert Kotlin/Jetpack Compose developer. The user will provide code and you must transform it into a dynamic Compose module. Return ONLY the complete, compilable Kotlin code with no explanations or markdown. The code should:
1. Be a self-contained Compose module
2. Use Material3 components
3. Include proper imports
4. Be production-ready with error handling
5. Include a @Composable function as the entry point`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const payload = JSON.stringify({
        model: "nvidia/nemotron-4-340b-instruct",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Transform this code into a dynamic Compose module:\n\n${code}\n\nMake this a dynamic Compose module that can be loaded at runtime via SplitCompat.`,
          },
        ],
        stream: true,
        max_tokens: 4096,
        temperature: 0.6,
      });

      const options = {
        hostname: "integrate.api.nvidia.com",
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          Accept: "text/event-stream",
        },
      };

      const proxyReq = https.request(options, (proxyRes) => {
        let buffer = "";

        proxyRes.on("data", (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              res.write("data: [DONE]\n\n");
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch {}
          }
        });

        proxyRes.on("end", () => {
          if (buffer.trim()) {
            const lines = buffer.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || "";
                if (content) {
                  res.write(`data: ${JSON.stringify({ content })}\n\n`);
                }
              } catch {}
            }
          }
          res.write("data: [DONE]\n\n");
          res.end();
        });

        proxyRes.on("error", (err) => {
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.end();
        });
      });

      proxyReq.on("error", (err) => {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      });

      proxyReq.write(payload);
      proxyReq.end();
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    }
  });

  app.post("/api/self-modify", async (req: Request, res: Response) => {
    try {
      const { code, instruction, apiKey } = req.body;
      const key = apiKey || process.env.NVIDIA_NIM_API_KEY;

      if (!key) {
        return res.status(400).json({ error: "No API key configured" });
      }

      const systemPrompt = `You are an AI that can modify and upgrade code. You receive existing code and an instruction for how to modify it. Return ONLY the complete modified code - no explanations, no markdown fences, no commentary. The code must be complete and ready to use.`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const payload = JSON.stringify({
        model: "nvidia/nemotron-4-340b-instruct",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Here is the current code:\n\n${code}\n\nInstruction: ${instruction}\n\nReturn the complete modified code only.`,
          },
        ],
        stream: true,
        max_tokens: 4096,
        temperature: 0.5,
      });

      const options = {
        hostname: "integrate.api.nvidia.com",
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          Accept: "text/event-stream",
        },
      };

      const proxyReq = https.request(options, (proxyRes) => {
        let buffer = "";

        proxyReq.on("error", (err) => {
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.end();
        });

        proxyRes.on("data", (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              res.write("data: [DONE]\n\n");
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch {}
          }
        });

        proxyRes.on("end", () => {
          if (buffer.trim()) {
            const lines = buffer.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || "";
                if (content) {
                  res.write(`data: ${JSON.stringify({ content })}\n\n`);
                }
              } catch {}
            }
          }
          res.write("data: [DONE]\n\n");
          res.end();
        });

        proxyRes.on("error", (err) => {
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.end();
        });
      });

      proxyReq.on("error", (err) => {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      });

      proxyReq.write(payload);
      proxyReq.end();
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
