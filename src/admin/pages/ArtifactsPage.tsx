import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Boxes,
  ImageIcon,
  Pencil,
  Plus,
  Trash2,
  Volume2,
  Globe,
  Mic,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Calendar,
} from "lucide-react";
import QRCode from "qrcode";
import { supabase } from "../services/supabase";
import { Artifact, ArtifactTranslation } from "../types";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { Skeleton } from "../components/LoadingSkeleton";
import Modal, { ConfirmModal } from "../components/Modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { translateAllLanguages } from "../utils/ArtifactUtil";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Sacred Vessels",
  "Liturgical Books",
  "Vestments",
  "Altar Furnishings",
  "Devotional Objects",
  "Sacramentals",
  "Musical Instruments",
  "Architectural and Decorative Elements",
];

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸", mmLang: "en-US" },
  { code: "fil", label: "Filipino", flag: "🇵🇭", mmLang: "tl-PH" },
  { code: "ja", label: "Japanese", flag: "🇯🇵", mmLang: "ja-JP" },
  { code: "es", label: "Spanish", flag: "🇪🇸", mmLang: "es-ES" },
  { code: "ko", label: "Korean", flag: "🇰🇷", mmLang: "ko-KR" },
] as const;

type LangCode = "en" | "fil" | "ja" | "es" | "ko";
const PAGE_SIZE = 8;

// ─── Form ─────────────────────────────────────────────────────────────────────

const emptyForm = {
  name: "",
  category: CATEGORIES[0],
  image_url: "",
  image_file: null as File | null,
  created_at: "",
  creator: "",
  historical_significance: "",
  // per-lang translation fields
  name_en: "",
  name_fil: "",
  name_ja: "",
  name_es: "",
  name_ko: "",
  desc_en: "",
  desc_fil: "",
  desc_ja: "",
  desc_es: "",
  desc_ko: "",
};
type AForm = typeof emptyForm;

// keyed by lang code: audio_url from artifact_translations
type AudioMap = Partial<Record<LangCode, string>>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function uploadImage(artifactId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `artifacts/${artifactId}.${ext}`;
  const { error } = await supabase.storage
    .from("artifact-images")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  return supabase.storage.from("artifact-images").getPublicUrl(path).data
    .publicUrl;
}

async function generateAudioViaAPI(
  artifactId: string,
  text: string,
  lang: LangCode,
  voiceName?: string,
  speakingRate?: number,
): Promise<{ success: boolean; audioUrl: string }> {
  const res = await fetch(
    "https://eturismoadminn.up.railway.app/generate-audio",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artifactId,
        text,
        lang,
        voiceName,
        speakingRate: speakingRate || 1.0,
      }),
    },
  );
  if (!res.ok) {
    const e = await res.json();
    throw new Error(e.error || "Failed to generate audio");
  }
  return res.json();
}

/** Upsert a single translation row */
async function upsertTranslation(
  artifactId: string,
  lang: LangCode,
  name: string,
  description: string,
  existingId?: string,
) {
  if (existingId) {
    return supabase
      .from("artifact_translations")
      .update({ name, description })
      .eq("id", existingId);
  }
  return supabase.from("artifact_translations").insert({
    artifact_id: artifactId,
    language_code: lang,
    name,
    description,
  });
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ArtifactsPage() {
  const [items, setItems] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [listError, setListError] = useState<string | null>(null);

  // translations keyed by artifact_id -> lang -> ArtifactTranslation
  const [txMap, setTxMap] = useState<
    Record<string, Record<string, ArtifactTranslation>>
  >({});
  // audio map for currently editing artifact
  const [audioMap, setAudioMap] = useState<AudioMap>({});

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [txIds, setTxIds] = useState<Partial<Record<LangCode, string>>>({});
  const [form, setForm] = useState<AForm>(emptyForm);
  const [imagePreview, setImagePreview] = useState("");
  const [modalStep, setModalStep] = useState(1);
  const [activeLang, setActiveLang] = useState<LangCode>("en");
  const [saving, setSaving] = useState(false);
  const [saveStep, setSaveStep] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteItem, setDeleteItem] = useState<Artifact | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [translating, setTranslating] = useState(false);
  const [translateStep, setTranslateStep] = useState("");

  const [audioSaving, setAudioSaving] = useState(false);
  const [audioStep, setAudioStep] = useState("");
  const [generatingAll, setGeneratingAll] = useState(false);
  const [audioStatus, setAudioStatus] = useState<Record<string, string>>({});

  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [speakingRate, setSpeakingRate] = useState(1.0);
  const [showVoiceControls, setShowVoiceControls] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchData(page);
  }, [page]);

  useEffect(() => {
    fetch(`https://eturismoadminn.up.railway.app/available-voices/${activeLang}`)
      .then((r) => r.json())
      .then((d) => {
        setAvailableVoices(d.voices || []);
        setSelectedVoice(d.defaultVoice || "");
      })
      .catch(() => {});
  }, [activeLang]);

  const fetchData = async (p: number) => {
    setLoading(true);
    setListError(null);
    try {
      const offset = (p - 1) * PAGE_SIZE;
      const { data, count, error } = await supabase
        .from("artifacts")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      const arts = (data || []) as Artifact[];
      setItems(arts);
      setTotal(count || 0);

      // fetch translations for this page
      if (arts.length > 0) {
        const ids = arts.map((a) => a.id);
        const { data: txData } = await supabase
          .from("artifact_translations")
          .select("*")
          .in("artifact_id", ids);
        const map: Record<string, Record<string, ArtifactTranslation>> = {};
        for (const tx of (txData || []) as ArtifactTranslation[]) {
          if (!map[tx.artifact_id]) map[tx.artifact_id] = {};
          map[tx.artifact_id][tx.language_code] = tx;
        }
        setTxMap(map);
      }
    } catch (e: any) {
      setListError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = items;
    if (category !== "all") list = list.filter((i) => i.category === category);
    const q = query.toLowerCase().trim();
    if (q)
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.category ?? "").toLowerCase().includes(q) ||
          (txMap[i.id]?.en?.description ?? "").toLowerCase().includes(q),
      );
    return list;
  }, [items, category, query, txMap]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setTxIds({});
    setForm(emptyForm);
    setImagePreview("");
    setActiveLang("en");
    setModalStep(1);
    setFormError(null);
    setAudioMap({});
    setShowModal(true);
  };

  const openEdit = async (a: Artifact) => {
    setEditingId(a.id);
    setModalStep(1);
    setActiveLang("en");
    setImagePreview(a.image_url || "");
    setFormError(null);

    // load translations
    const { data: txData } = await supabase
      .from("artifact_translations")
      .select("*")
      .eq("artifact_id", a.id);
    const txs = (txData || []) as ArtifactTranslation[];
    const byLang: Partial<Record<LangCode, ArtifactTranslation>> = {};
    const ids: Partial<Record<LangCode, string>> = {};
    for (const tx of txs) {
      byLang[tx.language_code as LangCode] = tx;
      ids[tx.language_code as LangCode] = tx.id;
    }
    setTxIds(ids);
    setAudioMap(
      Object.fromEntries(
        Object.entries(byLang)
          .filter(([, v]) => v?.audio_url)
          .map(([k, v]) => [k, v!.audio_url!]),
      ) as AudioMap,
    );

    setForm({
      name: a.name,
      category: a.category || CATEGORIES[0],
      image_url: a.image_url || "",
      image_file: null,
      created_at: a.created_at
        ? new Date(a.created_at).toISOString().slice(0, 10)
        : "",
      creator: a.creator || "",
      historical_significance: a.Historical_Significance || "",
      name_en: byLang.en?.name || a.name,
      name_fil: byLang.fil?.name || "",
      name_ja: byLang.ja?.name || "",
      name_es: byLang.es?.name || "",
      name_ko: byLang.ko?.name || "",
      desc_en: byLang.en?.description || "",
      desc_fil: byLang.fil?.description || "",
      desc_ja: byLang.ja?.description || "",
      desc_es: byLang.es?.description || "",
      desc_ko: byLang.ko?.description || "",
    });
    setShowModal(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f) => ({ ...f, image_file: file }));
    setImagePreview(URL.createObjectURL(file));
  };

  // ── Translate ──────────────────────────────────────────────────────────────

  const handleTranslate = async () => {
    if (!form.name.trim()) {
      alert("Enter an English name first.");
      return;
    }
    if (!form.desc_en.trim()) {
      alert("Enter an English description first.");
      return;
    }
    setTranslating(true);
    setTranslateStep("Starting translation…");
    try {
      const result = await translateAllLanguages(
        form.name,
        form.desc_en,
        setTranslateStep,
        "user@example.com",
      );
      setForm((f) => ({
        ...f,
        name_fil: result.name_fil || f.name_fil,
        name_ja: result.name_ja || f.name_ja,
        name_es: result.name_es || f.name_es,
        name_ko: result.name_ko || f.name_ko,
        desc_fil: result.description_fil || f.desc_fil,
        desc_ja: result.description_ja || f.desc_ja,
        desc_es: result.description_es || f.desc_es,
        desc_ko: result.description_ko || f.desc_ko,
      }));
      alert("✅ Translations completed!");
    } catch (e: any) {
      alert(`Translation error: ${e.message}`);
    } finally {
      setTranslating(false);
      setTranslateStep("");
    }
  };

  // ── Audio ──────────────────────────────────────────────────────────────────

  const setAudioStatusFor = (
    lang: string,
    status: string,
    clearAfter = 3000,
  ) => {
    setAudioStatus((p) => ({ ...p, [lang]: status }));
    if (clearAfter > 0)
      setTimeout(
        () =>
          setAudioStatus((p) => {
            const n = { ...p };
            delete n[lang];
            return n;
          }),
        clearAfter,
      );
  };

  const handleSaveAudio = async (langCode: LangCode) => {
    if (!editingId) {
      alert("Save the artifact first.");
      return;
    }
    const text = form[`desc_${langCode}` as keyof AForm] as string;
    if (!text?.trim()) {
      alert(
        `No ${LANGUAGES.find((l) => l.code === langCode)?.label} description yet.`,
      );
      return;
    }
    setAudioSaving(true);
    setAudioStep(`Generating ${langCode.toUpperCase()} audio…`);
    setAudioStatusFor(langCode, "generating", 0);
    try {
      const result = await generateAudioViaAPI(
        editingId,
        text,
        langCode,
        selectedVoice,
        speakingRate,
      );
      if (result.success) {
        setAudioMap((p) => ({ ...p, [langCode]: result.audioUrl }));
        setAudioStatusFor(langCode, "success");
        alert(
          `Audio for ${LANGUAGES.find((l) => l.code === langCode)?.label} saved!`,
        );
      } else {
        throw new Error(result.error || "Audio generation failed");
      }
    } catch (e: any) {
      console.error(`Audio generation error for ${langCode}:`, e);
      setAudioStatusFor(langCode, "error");
      alert(`Audio error: ${e.message}`);
    } finally {
      setAudioSaving(false);
      setAudioStep("");
    }
  };

  const handleGenerateAllAudio = async () => {
    if (!editingId) {
      alert("Save the artifact first.");
      return;
    }
    const pairs: [LangCode, string][] = [
      ["en", form.desc_en],
      ["fil", form.desc_fil],
      ["ja", form.desc_ja],
      ["es", form.desc_es],
      ["ko", form.desc_ko],
    ].filter(([, t]) => (t as string).trim()) as [LangCode, string][];
    if (!pairs.length) {
      alert("No descriptions to generate audio from.");
      return;
    }
    setGeneratingAll(true);
    let ok = 0,
      fail = 0;
    for (const [lang, text] of pairs) {
      setAudioStep(`Generating ${lang.toUpperCase()} audio…`);
      setAudioStatusFor(lang, "generating", 0);
      try {
        const r = await generateAudioViaAPI(
          editingId,
          text,
          lang,
          selectedVoice,
          speakingRate,
        );
        setAudioMap((p) => ({ ...p, [lang]: r.audioUrl }));
        setAudioStatusFor(lang, "success");
        ok++;
      } catch {
        setAudioStatusFor(lang, "error");
        fail++;
      }
    }
    setGeneratingAll(false);
    setAudioStep("");
    if (ok > 0) {
      alert(
        `✅ ${ok} audio file(s) generated!${fail ? ` (${fail} failed)` : ""}`,
      );
      await fetchData(page);
    } else alert(`❌ Failed to generate ${fail} audio file(s).`);
  };

  // ── Save artifact ──────────────────────────────────────────────────────────

  const handleSaveArtifact = async () => {
    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    setSaving(true);
    setSaveStep("Saving artifact…");
    setFormError(null);
    try {
      const payload = {
        name: form.name,
        category: form.category,
        image_url: form.image_url || null,
        creator: form.creator || null,
        Historical_Significance: form.historical_significance || null,
        created_at: form.created_at
          ? new Date(form.created_at).toISOString()
          : new Date().toISOString(),
      };

      let artifactId = editingId!;
      if (editingId) {
        const { error } = await supabase
          .from("artifacts")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("artifacts")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        artifactId = data.id;
      }

      if (form.image_file) {
        setSaveStep("Uploading image…");
        const url = await uploadImage(artifactId, form.image_file);
        await supabase
          .from("artifacts")
          .update({ image_url: url })
          .eq("id", artifactId);
      }

      // QR code
      setSaveStep("Generating QR code…");
      const qrValue = `${window.location.origin}/artifact/${artifactId}`;
      const qrDataUrl = await QRCode.toDataURL(qrValue);
      const { error: qrErr } = await supabase.storage
        .from("qrcode")
        .upload(`${artifactId}.png`, dataUrlToBlob(qrDataUrl), {
          contentType: "image/png",
          upsert: true,
        });
      if (!qrErr) {
        const { data: qrPub } = supabase.storage
          .from("qrcode")
          .getPublicUrl(`${artifactId}.png`);
        await supabase
          .from("artifacts")
          .update({ qr_code: qrPub.publicUrl, qr_value: qrValue })
          .eq("id", artifactId);
      }

      // Upsert translations
      setSaveStep("Saving translations…");
      const langs: LangCode[] = ["en", "fil", "ja", "es", "ko"];
      for (const lang of langs) {
        const name =
          (form[`name_${lang}` as keyof AForm] as string) ||
          (lang === "en" ? form.name : "");
        const desc = form[`desc_${lang}` as keyof AForm] as string;
        if (!name && !desc) continue;
        await upsertTranslation(
          artifactId,
          lang,
          name || form.name,
          desc,
          txIds[lang],
        );
      }

      // Generate audio for new artifacts
      if (!editingId) {
        // Small delay to ensure translation records are committed to database
        await new Promise((resolve) => setTimeout(resolve, 500));

        setSaveStep("Generating audio…");
        const audioErrors: string[] = [];
        for (const lang of langs) {
          const text = form[`desc_${lang}` as keyof AForm] as string;
          if (text?.trim()) {
            try {
              setSaveStep(`Generating ${lang.toUpperCase()} audio…`);
              const result = await generateAudioViaAPI(
                artifactId,
                text,
                lang,
                selectedVoice,
                speakingRate,
              );
              if (result.success) {
                console.log(
                  `Audio generated successfully for ${lang}: ${result.audioUrl}`,
                );
              } else {
                console.error(`Audio generation failed for ${lang}:`, result);
                audioErrors.push(
                  `${lang.toUpperCase()}: ${result.error || "Unknown error"}`,
                );
              }
            } catch (error: any) {
              console.error(`Audio generation error for ${lang}:`, error);
              audioErrors.push(`${lang.toUpperCase()}: ${error.message}`);
            }
          }
        }
        if (audioErrors.length > 0) {
          console.warn("Some audio generation failed:", audioErrors);
          // Don't fail the save, just log the errors
        }
      }

      setShowModal(false);
      await fetchData(page);
      alert("✅ Artifact saved!");
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
      setSaveStep("");
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    // translations cascade via FK; audio_guides also cascade
    const { error } = await supabase
      .from("artifacts")
      .delete()
      .eq("id", deleteItem.id);
    if (error) alert(`Delete failed: ${error.message}`);
    setDeleteItem(null);
    const newTotal = total - 1;
    const safeP = Math.min(page, Math.max(1, Math.ceil(newTotal / PAGE_SIZE)));
    if (safeP !== page) setPage(safeP);
    else await fetchData(page);
    setDeleting(false);
  };

  // ── Audio playback ─────────────────────────────────────────────────────────

  const playAudio = (artifactId: string, lang: (typeof LANGUAGES)[number]) => {
    const audioUrl = txMap[artifactId]?.[lang.code]?.audio_url;
    if (audioUrl) {
      new Audio(audioUrl).play().catch(() => {});
      return;
    }
    const desc = txMap[artifactId]?.[lang.code]?.description;
    if (desc && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(desc);
      u.lang = lang.mmLang;
      window.speechSynthesis.speak(u);
    }
  };

  const audioStatusIcon = (lang: string) => {
    const s = audioStatus[lang];
    if (s === "generating") return <Spinner className="ml-1" />;
    if (s === "success")
      return <Check className="ml-1 h-3 w-3 text-emerald-500" />;
    if (s === "error") return <X className="ml-1 h-3 w-3 text-red-500" />;
    return null;
  };

  const activeNameKey = `name_${activeLang}` as keyof AForm;
  const activeDescKey = `desc_${activeLang}` as keyof AForm;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        eyebrow="Sacred Collection"
        title="Artifacts"
        description="Manage sacred vessels, vestments, books, and devotional objects."
        actions={
          <Button onClick={openCreate} className="rounded-xl">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Artifact
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artifacts…"
            className="h-9 w-full rounded-xl border-border bg-muted/40 text-sm sm:w-56"
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-full rounded-xl border-border bg-muted/40 text-xs sm:w-56">
              <SelectValue placeholder="Filter category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length} items
        </span>
      </div>

      {listError && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
          {listError}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl border-border bg-card">
          <EmptyState
            icon={<Boxes className="h-5 w-5" />}
            title={
              query || category !== "all"
                ? "No matching artifacts"
                : "No artifacts yet"
            }
            description={
              query || category !== "all"
                ? "Try adjusting your filters."
                : "Add your first artifact."
            }
            action={
              !query &&
              category === "all" && (
                <Button
                  onClick={openCreate}
                  variant="outline"
                  className="rounded-xl"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add artifact
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {filtered.map((a) => {
            const artTx = txMap[a.id] || {};
            const langsWithDesc = LANGUAGES.filter(
              (l) => artTx[l.code]?.description,
            );
            const langsWithAudio = LANGUAGES.filter(
              (l) => artTx[l.code]?.audio_url,
            );
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="group flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                    {a.image_url ? (
                      <img
                        src={a.image_url}
                        alt={a.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                    )}
                    {a.qr_code && (
                      <img
                        src={a.qr_code}
                        alt="QR"
                        className="absolute bottom-0.5 right-0.5 h-5 w-5 rounded-sm border border-border bg-white p-0.5 opacity-0 transition group-hover:opacity-100"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-foreground">
                        {a.name}
                      </h3>
                      <Badge
                        variant="outline"
                        className="rounded-full border-border bg-muted/40 text-[10px] text-muted-foreground"
                      >
                        {a.category}
                      </Badge>
                    </div>
                    {artTx.en?.description && (
                      <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-muted-foreground">
                        {artTx.en.description}
                      </p>
                    )}
                    {langsWithDesc.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {langsWithDesc.map((l) => (
                          <button
                            key={l.code}
                            onClick={() => playAudio(a.id, l)}
                            title={`${l.label}${langsWithAudio.find((x) => x.code === l.code) ? " — audio available" : ""}`}
                            className="inline-flex items-center gap-0.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
                          >
                            {l.flag} {l.code.toUpperCase()}
                            {langsWithAudio.find((x) => x.code === l.code) && (
                              <Volume2 className="h-2.5 w-2.5 text-emerald-500" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(a)}
                    className="h-8 rounded-lg text-xs"
                  >
                    <Pencil className="mr-1 h-3 w-3" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteItem(a)}
                    className="h-8 rounded-lg text-xs text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-1 h-3 w-3" /> Delete
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-xl"
          >
            <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl"
          >
            Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* ── Create / Edit Modal ────────────────────────────────────────────── */}
      <Modal
        open={showModal}
        onOpenChange={(o) => {
          if (!saving) setShowModal(o);
        }}
        title={editingId ? "Edit Artifact" : "New Artifact"}
        description={
          modalStep === 1
            ? "Basic information and image."
            : "Multilingual descriptions and audio."
        }
        size="lg"
        footer={
          <div className="flex w-full items-center justify-between">
            {modalStep === 2 ? (
              <Button
                variant="ghost"
                onClick={() => setModalStep(1)}
                disabled={saving}
                className="rounded-xl"
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Back
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() => !saving && setShowModal(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
            )}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 mr-3">
                <span
                  className={`h-2 w-2 rounded-full ${modalStep === 1 ? "bg-foreground" : "bg-muted-foreground/30"}`}
                />
                <span
                  className={`h-2 w-2 rounded-full ${modalStep === 2 ? "bg-foreground" : "bg-muted-foreground/30"}`}
                />
              </div>
              {modalStep === 1 ? (
                <Button
                  onClick={() => setModalStep(2)}
                  disabled={!form.name.trim()}
                  className="rounded-xl"
                >
                  Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  onClick={handleSaveArtifact}
                  disabled={saving}
                  className="rounded-xl"
                >
                  {saving ? (
                    <>
                      <Spinner className="mr-2" />
                      {saveStep}
                    </>
                  ) : editingId ? (
                    "Update Artifact"
                  ) : (
                    "Create Artifact"
                  )}
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {modalStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="space-y-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Name (English) *</Label>
                    <Input
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          name: e.target.value,
                          name_en: e.target.value,
                        }))
                      }
                      placeholder="e.g. Chalice of St. John"
                      className="h-10 rounded-xl bg-muted/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Category</Label>
                    <Select
                      value={form.category}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, category: v }))
                      }
                    >
                      <SelectTrigger className="h-10 rounded-xl bg-muted/40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Upload Image</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Image URL (optional)</Label>
                    <Input
                      type="url"
                      value={form.image_url}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, image_url: e.target.value }))
                      }
                      className="h-10 rounded-xl bg-muted/40"
                      placeholder="https://…"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> Date Created
                    </Label>
                    <Input
                      type="date"
                      value={form.created_at}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, created_at: e.target.value }))
                      }
                      className="h-10 rounded-xl bg-muted/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Creator</Label>
                    <Input
                      value={form.creator}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, creator: e.target.value }))
                      }
                      placeholder="e.g. Unknown craftsman"
                      className="h-10 rounded-xl bg-muted/40"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Historical Significance</Label>
                  <Textarea
                    rows={3}
                    value={form.historical_significance}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        historical_significance: e.target.value,
                      }))
                    }
                    placeholder="Brief note on historical significance…"
                    className="rounded-xl bg-muted/40"
                  />
                </div>
                {(imagePreview || form.image_url) && (
                  <img
                    src={imagePreview || form.image_url}
                    alt="preview"
                    className="max-h-40 rounded-xl border border-border object-cover"
                  />
                )}
              </motion.div>
            )}

            {modalStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="space-y-4"
              >
                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTranslate}
                    disabled={translating || !form.desc_en.trim()}
                    className="rounded-xl text-xs"
                  >
                    {translating ? (
                      <>
                        <Spinner className="mr-1.5" />
                        {translateStep || "Translating…"}
                      </>
                    ) : (
                      <>
                        <Globe className="mr-1.5 h-3.5 w-3.5" />
                        Auto-translate
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant={showVoiceControls ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowVoiceControls((v) => !v)}
                    className="rounded-xl text-xs"
                  >
                    <Mic className="mr-1.5 h-3.5 w-3.5" />
                    {showVoiceControls
                      ? "Hide Voice Settings"
                      : "Voice Settings"}
                  </Button>
                  {editingId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateAllAudio}
                      disabled={generatingAll || audioSaving}
                      className="rounded-xl text-xs"
                    >
                      {generatingAll || audioSaving ? (
                        <>
                          <Spinner className="mr-1.5" />
                          {audioStep || "Generating…"}
                        </>
                      ) : (
                        <>
                          <Volume2 className="mr-1.5 h-3.5 w-3.5" />
                          Generate All Audio
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Voice controls */}
                <AnimatePresence>
                  {showVoiceControls && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden rounded-xl border border-border bg-muted/40 p-4"
                    >
                      <p className="mb-3 text-xs font-semibold text-foreground">
                        Voice Settings —{" "}
                        {LANGUAGES.find((l) => l.code === activeLang)?.label}
                      </p>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Voice</Label>
                          <Select
                            value={selectedVoice}
                            onValueChange={setSelectedVoice}
                          >
                            <SelectTrigger className="h-9 rounded-xl bg-background text-xs">
                              <SelectValue placeholder="Select voice…" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableVoices.map((v) => (
                                <SelectItem
                                  key={v.name}
                                  value={v.name}
                                  className="text-xs"
                                >
                                  {v.description} ({v.gender}) — {v.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">
                            Speaking Speed: {speakingRate.toFixed(1)}×
                          </Label>
                          <input
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.1"
                            value={speakingRate}
                            onChange={(e) =>
                              setSpeakingRate(parseFloat(e.target.value))
                            }
                            className="w-full accent-foreground"
                          />
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Slower (0.5×)</span>
                            <span>Normal (1.0×)</span>
                            <span>Faster (2.0×)</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Language tabs */}
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setActiveLang(l.code as LangCode)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition
                        ${activeLang === l.code ? "border-foreground bg-foreground text-background" : "border-border bg-transparent text-foreground hover:border-foreground/40"}`}
                    >
                      {l.flag} {l.label}
                      {audioMap[l.code as LangCode] && (
                        <Volume2 className="ml-0.5 h-2.5 w-2.5 text-emerald-500" />
                      )}
                      {audioStatusIcon(l.code)}
                    </button>
                  ))}
                </div>

                {/* Translated name */}
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Name ({LANGUAGES.find((l) => l.code === activeLang)?.label})
                  </Label>
                  <Input
                    value={(form[activeNameKey] as string) || ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        [activeNameKey]: e.target.value,
                      }))
                    }
                    placeholder={`Name in ${LANGUAGES.find((l) => l.code === activeLang)?.label}…`}
                    className="h-10 rounded-xl bg-muted/40 text-sm"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Description (
                    {LANGUAGES.find((l) => l.code === activeLang)?.label})
                  </Label>
                  <Textarea
                    rows={7}
                    value={form[activeDescKey] as string}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        [activeDescKey]: e.target.value,
                      }))
                    }
                    placeholder={`Description in ${LANGUAGES.find((l) => l.code === activeLang)?.label}…`}
                    className="rounded-xl bg-muted/40"
                  />
                </div>

                {/* Per-language audio */}
                {editingId && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSaveAudio(activeLang)}
                      disabled={
                        audioSaving || !(form[activeDescKey] as string)?.trim()
                      }
                      className="rounded-xl text-xs"
                    >
                      {audioSaving &&
                      audioStep.includes(activeLang.toUpperCase()) ? (
                        <>
                          <Spinner className="mr-1.5" />
                          {audioStep}
                        </>
                      ) : (
                        <>
                          <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
                          Generate & Save Audio (
                          {LANGUAGES.find((l) => l.code === activeLang)?.label})
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {formError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
              {formError}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteItem}
        onOpenChange={(o) => !o && setDeleteItem(null)}
        title="Delete Artifact"
        description={`Delete "${deleteItem?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
