import { createFileRoute } from "@tanstack/react-router";

type Body = {
  prompt: string;
  systemMessage?: string;
  fewShotExamples?: string;
  imageUrl?: string;
  imageDataUrl?: string;
  verbosity?: "low" | "medium" | "high";
  reasoningEffort?: "low" | "medium" | "high" | "xhigh";
};

export const Route = createFileRoute("/api/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const start = Date.now();
        try {
          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey) {
            return Response.json(
              { error: "OPENAI_API_KEY is not configured on the server." },
              { status: 500 },
            );
          }

          const body = (await request.json()) as Body;
          const prompt = (body.prompt || "").trim();
          if (!prompt) {
            return Response.json({ error: "Prompt is required." }, { status: 400 });
          }

          const verbosity = body.verbosity ?? "medium";
          const reasoningEffort = body.reasoningEffort ?? "high";

          // Build user message content
          let userText = prompt;
          if (body.fewShotExamples && body.fewShotExamples.trim()) {
            userText = `Style examples:\n${body.fewShotExamples.trim()}\n\n---\n\n${prompt}`;
          }

          const imageSrc = body.imageDataUrl || body.imageUrl;
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
          if (body.systemMessage && body.systemMessage.trim()) {
            payload.instructions = body.systemMessage.trim();
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
            console.error(`[generate] ${res.status} in ${duration}ms:`, errText);
            return Response.json(
              { error: `OpenAI error (${res.status}): ${errText.slice(0, 500)}` },
              { status: res.status },
            );
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
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
