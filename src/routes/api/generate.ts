import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";


type Body = {
  prompt?: unknown;
  systemMessage?: unknown;
  fewShotExamples?: unknown;
  imageUrl?: unknown;
  imageDataUrl?: unknown;
  verbosity?: unknown;
  reasoningEffort?: unknown;
};

const GENERIC_ERROR = "Generation failed. Please try again.";

const VERBOSITY = new Set(["low", "medium", "high"]);
const EFFORT = new Set(["low", "medium", "high", "xhigh"]);

const MAX_PROMPT = 2000;
const MAX_SYSTEM = 1000;
const MAX_FEWSHOT = 3000;
const MAX_IMAGE_DATA_URL = 5_000_000; // ~5MB base64

function isString(v: unknown): v is string {
  return typeof v === "string";
}

export const Route = createFileRoute("/api/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const start = Date.now();
        try {
          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey) {
            console.error("[generate] missing OPENAI_API_KEY env var");
            return Response.json({ error: GENERIC_ERROR }, { status: 500 });
          }

          // Optional shared-secret gate. If GENERATE_API_SECRET is configured,
          // require callers to send a matching X-API-Secret header. This blocks
          // anonymous abuse of the paid OpenAI proxy.
          const requiredSecret = process.env.GENERATE_API_SECRET;
          if (requiredSecret) {
            const provided = request.headers.get("x-api-secret");
            if (!provided || provided !== requiredSecret) {
              return Response.json({ error: "Unauthorized" }, { status: 401 });
            }
          }

          let body: Body;
          try {
            body = (await request.json()) as Body;
          } catch {
            return Response.json({ error: "Invalid JSON body." }, { status: 400 });
          }

          // --- Validate inputs ---
          if (!isString(body.prompt)) {
            return Response.json({ error: "Prompt is required." }, { status: 400 });
          }
          const prompt = body.prompt.trim();
          if (!prompt) {
            return Response.json({ error: "Prompt is required." }, { status: 400 });
          }
          if (prompt.length > MAX_PROMPT) {
            return Response.json(
              { error: `Prompt exceeds ${MAX_PROMPT} characters.` },
              { status: 400 },
            );
          }

          let systemMessage: string | undefined;
          if (body.systemMessage !== undefined) {
            if (!isString(body.systemMessage) || body.systemMessage.length > MAX_SYSTEM) {
              return Response.json({ error: "Invalid systemMessage." }, { status: 400 });
            }
            systemMessage = body.systemMessage.trim() || undefined;
          }

          let fewShotExamples: string | undefined;
          if (body.fewShotExamples !== undefined) {
            if (!isString(body.fewShotExamples) || body.fewShotExamples.length > MAX_FEWSHOT) {
              return Response.json({ error: "Invalid fewShotExamples." }, { status: 400 });
            }
            fewShotExamples = body.fewShotExamples.trim() || undefined;
          }

          let imageUrl: string | undefined;
          if (body.imageUrl !== undefined) {
            if (!isString(body.imageUrl)) {
              return Response.json({ error: "Invalid imageUrl." }, { status: 400 });
            }
            try {
              const u = new URL(body.imageUrl);
              if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("bad proto");
              imageUrl = u.toString();
            } catch {
              return Response.json({ error: "Invalid imageUrl." }, { status: 400 });
            }
          }

          let imageDataUrl: string | undefined;
          if (body.imageDataUrl !== undefined) {
            if (
              !isString(body.imageDataUrl) ||
              body.imageDataUrl.length > MAX_IMAGE_DATA_URL ||
              !body.imageDataUrl.startsWith("data:image/")
            ) {
              return Response.json({ error: "Invalid imageDataUrl." }, { status: 400 });
            }
            imageDataUrl = body.imageDataUrl;
          }

          const verbosity =
            isString(body.verbosity) && VERBOSITY.has(body.verbosity)
              ? (body.verbosity as "low" | "medium" | "high")
              : "medium";
          const reasoningEffort =
            isString(body.reasoningEffort) && EFFORT.has(body.reasoningEffort)
              ? (body.reasoningEffort as "low" | "medium" | "high" | "xhigh")
              : "high";

          // Build user message content
          let userText = prompt;
          if (fewShotExamples) {
            userText = `Style examples:\n${fewShotExamples}\n\n---\n\n${prompt}`;
          }

          const imageSrc = imageDataUrl || imageUrl;
          if (imageSrc) {
            userText += `\n\nUse the image only if relevant; do not hallucinate details.`;
          }

          const content: Array<Record<string, unknown>> = [
            { type: "input_text", text: userText },
          ];
          if (imageSrc) {
            content.push({ type: "input_image", image_url: imageSrc });
          }

          const payload: Record<string, unknown> = {
            model: "gpt-5",
            input: [{ role: "user", content }],
            text: { verbosity },
            reasoning: { effort: reasoningEffort === "xhigh" ? "high" : reasoningEffort },
          };
          if (systemMessage) {
            payload.instructions = systemMessage;
          }

          const res = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });

          const duration = Date.now() - start;
          if (!res.ok) {
            const errText = await res.text();
            console.error(`[generate] upstream ${res.status} in ${duration}ms:`, errText);
            // Never forward upstream error details to the client.
            const status = res.status === 429 ? 429 : 502;
            return Response.json({ error: GENERIC_ERROR }, { status });
          }

          const data = (await res.json()) as {
            output_text?: string;
            output?: Array<{ content?: Array<{ type: string; text?: string }> }>;
          };

          let text = data.output_text ?? "";
          if (!text && Array.isArray(data.output)) {
            text = data.output
              .flatMap((o) => o.content ?? [])
              .filter((c) => c.type === "output_text" && c.text)
              .map((c) => c.text!)
              .join("\n");
          }

          console.log(`[generate] ok in ${duration}ms (${text.length} chars)`);
          return Response.json({ text, image_used: Boolean(imageSrc) });
        } catch (e) {
          const duration = Date.now() - start;
          const message = e instanceof Error ? e.message : String(e);
          console.error(`[generate] failed in ${duration}ms:`, message);
          return Response.json({ error: GENERIC_ERROR }, { status: 500 });
        }
      },
    },
  },
});
