import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

import {
  ChevronDown,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  PenLine,
  ThumbsUp,
  MessageCircle,
  Share2,
  Upload,
  Link as LinkIcon,
  User,
  X,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LinkedIn Post Generator" },
      {
        name: "description",
        content: "Generate high-quality LinkedIn posts from a prompt.",
      },
      { property: "og:title", content: "LinkedIn Post Generator" },
      {
        property: "og:description",
        content: "Generate high-quality LinkedIn posts from a prompt.",
      },
    ],
  }),
  component: Index,
});

type Verbosity = "low" | "medium" | "high";
type Effort = "low" | "medium" | "high" | "xhigh";

function Index() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const [prompt, setPrompt] = useState("Write a post about …");

  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [systemMessageEnabled, setSystemMessageEnabled] = useState(false);
  const [systemMessage, setSystemMessage] = useState("");

  const [fewShotEnabled, setFewShotEnabled] = useState(false);
  const [fewShotExamples, setFewShotExamples] = useState("");

  const [imageUrl, setImageUrl] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [verbosity, setVerbosity] = useState<Verbosity>("medium");
  const [reasoningEffort, setReasoningEffort] = useState<Effort>("high");

  const [generatedText, setGeneratedText] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeImage = imageDataUrl || imageUrl;

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      setImageUrl("");
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageDataUrl(null);
    setImageUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const generate = async () => {
    if (!session) {
      navigate({ to: "/auth" });
      return;
    }
    if (!prompt.trim()) {
      setError("Prompt is required.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          prompt,
          systemMessage: systemMessageEnabled ? systemMessage : undefined,
          fewShotExamples: fewShotEnabled ? fewShotExamples : undefined,
          imageUrl: imageDataUrl ? undefined : imageUrl || undefined,
          imageDataUrl: imageDataUrl || undefined,
          verbosity,
          reasoningEffort,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate post.");
      setGeneratedText(data.text || "");
      setPreviewImage(activeImage || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-page">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft">
              <PenLine className="h-6 w-6 text-brand" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                LinkedIn Post Generator
              </h1>
              <p className="truncate text-sm text-muted-foreground">
                Generate high-quality LinkedIn posts from a prompt
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {authReady && session ? (
              <>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {session.user.email}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={signOut}
                  className="rounded-full"
                >
                  Sign out
                </Button>
              </>
            ) : authReady ? (
              <Button asChild variant="brand" size="lg" className="rounded-full">
                <Link to="/auth">Sign in</Link>
              </Button>
            ) : null}
            <Button
              variant="brand"
              size="lg"
              onClick={generate}
              disabled={loading || !session}
              className="rounded-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                </>
              ) : (
                "Generate Post"
              )}
            </Button>
          </div>

        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-2">
        {/* Left: inputs */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="prompt" className="text-sm font-semibold">
                Prompt <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Share a prompt for your LinkedIn post…"
                rows={3}
                className="resize-y rounded-xl"
              />
            </div>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted">
                Advanced Controls
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    advancedOpen && "rotate-180",
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-5">
                {/* System message */}
                <div className="space-y-2 rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">System Message</Label>
                    <Switch
                      checked={systemMessageEnabled}
                      onCheckedChange={setSystemMessageEnabled}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sets the assistant's role and constraints.
                  </p>
                  {systemMessageEnabled && (
                    <Textarea
                      value={systemMessage}
                      onChange={(e) => setSystemMessage(e.target.value)}
                      placeholder="You are a LinkedIn ghostwriter…"
                      rows={3}
                      className="rounded-lg"
                    />
                  )}
                </div>

                {/* Few-shot */}
                <div className="space-y-2 rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Few-Shot Examples</Label>
                    <Switch
                      checked={fewShotEnabled}
                      onCheckedChange={setFewShotEnabled}
                    />
                  </div>
                  {fewShotEnabled && (
                    <Textarea
                      value={fewShotExamples}
                      onChange={(e) => setFewShotExamples(e.target.value)}
                      placeholder="Paste example posts here…"
                      rows={5}
                      className="rounded-lg"
                    />
                  )}
                </div>

                {/* Image */}
                <div className="space-y-3 rounded-xl border border-border p-4">
                  <Label className="text-sm font-semibold">Image (optional)</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={imageUrl}
                        onChange={(e) => {
                          setImageUrl(e.target.value);
                          if (e.target.value) setImageDataUrl(null);
                        }}
                        placeholder="Image URL"
                        className="rounded-lg pl-9"
                      />
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg"
                    >
                      <Upload className="h-4 w-4" /> Upload
                    </Button>
                  </div>
                  {activeImage && (
                    <div className="relative inline-block">
                      <img
                        src={activeImage}
                        alt="Selected"
                        className="h-20 w-20 rounded-lg border border-border object-cover"
                      />
                      <button
                        type="button"
                        onClick={clearImage}
                        className="absolute -right-2 -top-2 rounded-full bg-foreground p-1 text-background shadow"
                        aria-label="Remove image"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Verbosity</Label>
                    <Select
                      value={verbosity}
                      onValueChange={(v) => setVerbosity(v as Verbosity)}
                    >
                      <SelectTrigger className="rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">low</SelectItem>
                        <SelectItem value="medium">medium</SelectItem>
                        <SelectItem value="high">high</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Reasoning effort</Label>
                    <Select
                      value={reasoningEffort}
                      onValueChange={(v) => setReasoningEffort(v as Effort)}
                    >
                      <SelectTrigger className="rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">low</SelectItem>
                        <SelectItem value="medium">medium</SelectItem>
                        <SelectItem value="high">high</SelectItem>
                        <SelectItem value="xhigh">xhigh</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="break-words">{error}</p>
              </div>
            )}

            <Button
              variant="generate"
              size="lg"
              onClick={generate}
              disabled={loading}
              className="w-full rounded-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Generating…
                </>
              ) : (
                "Generate Post"
              )}
            </Button>
          </div>
        </section>

        {/* Right: preview */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="rounded-xl border border-border bg-background">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft">
                  <User className="h-5 w-5 text-brand" />
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-foreground">Your Profile</p>
                  <p className="text-xs text-muted-foreground">1h • 🌐</p>
                </div>
              </div>
              <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="px-4 pb-4">
              {generatedText ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {renderWithHashtags(generatedText)}
                </p>
              ) : (
                <p className="text-sm italic text-muted-foreground">
                  Your generated post will appear here.
                </p>
              )}
            </div>

            {previewImage && (
              <img
                src={previewImage}
                alt="Post"
                loading="lazy"
                className="max-h-96 w-full border-y border-border object-cover"
              />
            )}
            {!previewImage && !generatedText && (
              <div className="flex h-48 items-center justify-center border-y border-border bg-muted/30 text-muted-foreground">
                <ImageIcon className="h-10 w-10" />
              </div>
            )}

            <div className="flex items-center justify-around p-2 text-sm text-muted-foreground">
              <PreviewAction icon={<ThumbsUp className="h-4 w-4" />} label="Like" />
              <PreviewAction icon={<MessageCircle className="h-4 w-4" />} label="Comment" />
              <PreviewAction icon={<Share2 className="h-4 w-4" />} label="Share" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function PreviewAction({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex items-center gap-2 rounded-md px-3 py-2 font-medium hover:bg-muted">
      {icon} {label}
    </button>
  );
}

function renderWithHashtags(text: string) {
  const parts = text.split(/(#[\p{L}0-9_]+)/gu);
  return parts.map((p, i) =>
    p.startsWith("#") ? (
      <span key={i} className="text-link font-medium">
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}
