import React, { useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalIcon,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  ImageIcon,
  Upload,
  Link2,
  AlignLeft,
  Clock,
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { Announcement } from '../types';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import SearchBar from '../components/SearchBar';
import { Skeleton } from '../components/LoadingSkeleton';
import Modal, { ConfirmModal } from '../components/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// ─── types ───────────────────────────────────────────────────────────────────

const emptyForm = {
  title: '',
  description: '',
  announcement_datetime: '',
  image_url: '',
};

type AForm = typeof emptyForm;

// ─── helpers ─────────────────────────────────────────────────────────────────

const STORAGE_BUCKET = 'media';
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/svg+xml'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function isValidImageType(file: File): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(file.type);
}

function getFileExtension(file: File): string {
  const parts = file.name.split('.');
  return parts[parts.length - 1].toLowerCase();
}

async function uploadToStorage(file: File): Promise<string> {
  const ext = getFileExtension(file);
  const fileName = `${Date.now()}.${ext}`;
  const filePath = `announcements/${fileName}`;
  
  console.log('Uploading to bucket:', STORAGE_BUCKET);
  console.log('File path:', filePath);
  
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, { 
      upsert: true,
      cacheControl: '3600',
      contentType: file.type
    });
    
  if (uploadError) {
    console.error('Upload error details:', uploadError);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }
  
  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);
  
  console.log('Generated public URL:', publicUrl);
  
  return publicUrl;
}

// ─── AnnouncementImage Component ────────────────────────────────────────────

function AnnouncementImage({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  if (!url || imgError) {
    return (
      <div className={cn('flex items-center justify-center bg-muted/30', className)}>
        <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
      </div>
    );
  }
  
  return (
    <div className={cn('overflow-hidden bg-muted/30 relative', className)}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
      <img
        src={url}
        alt=""
        className="h-full w-full object-cover"
        onError={() => {
          console.error('Image failed to load:', url);
          setImgError(true);
          setIsLoading(false);
        }}
        onLoad={() => {
          console.log('Image loaded successfully:', url);
          setIsLoading(false);
        }}
      />
    </div>
  );
}

// ─── image upload / url tab ───────────────────────────────────────────────────

function ImageSourcePicker({
  form,
  setForm,
}: {
  form: AForm;
  setForm: React.Dispatch<React.SetStateAction<AForm>>;
}) {
  const [tab, setTab] = useState<'upload' | 'url'>('upload');
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!isValidImageType(file)) {
      setUploadErr(`Unsupported file type: ${file.type}. Supported types: JPEG, PNG, WEBP, GIF, BMP, SVG`);
      return;
    }
    
    if (file.size > MAX_FILE_SIZE) {
      setUploadErr(`File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
      return;
    }
    
    setUploading(true);
    setUploadErr(null);
    setPreviewError(false);
    
    try {
      const url = await uploadToStorage(file);
      setForm((f) => ({ ...f, image_url: url }));
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadErr(err.message ?? 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileRef.current) {
        fileRef.current.value = '';
      }
    }
  };

  const handleUrlChange = (url: string) => {
    setForm((f) => ({ ...f, image_url: url }));
    setPreviewError(false);
  };

  const testImageUrl = (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  };

  const validateUrl = async (url: string) => {
    if (!url) return;
    const isValid = await testImageUrl(url);
    if (!isValid) {
      setUploadErr('Invalid image URL. Please check the URL and try again.');
    } else {
      setUploadErr(null);
    }
    setPreviewError(!isValid);
  };

  return (
    <div className="space-y-3">
      <Label className="text-xs">Cover image</Label>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'upload' | 'url')}>
        <TabsList className="h-8 rounded-lg">
          <TabsTrigger value="upload" className="h-7 rounded-md px-3 text-xs">
            <Upload className="mr-1.5 h-3 w-3" /> Upload
          </TabsTrigger>
          <TabsTrigger value="url" className="h-7 rounded-md px-3 text-xs">
            <Link2 className="mr-1.5 h-3 w-3" /> URL
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'upload' ? (
        <div>
          <input 
            ref={fileRef} 
            type="file" 
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/bmp,image/svg+xml" 
            className="hidden" 
            onChange={handleFile} 
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 py-6 text-xs text-muted-foreground transition',
              'hover:border-foreground/40 hover:bg-muted/50 disabled:opacity-60',
              form.image_url && 'border-primary/40'
            )}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Uploading...</span>
              </div>
            ) : form.image_url ? (
              <>
                <ImageIcon className="h-5 w-5 text-primary" />
                <span className="text-primary">Image uploaded — click to replace</span>
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                <span>Click to choose a file</span>
                <span className="text-[10px] text-muted-foreground/60">
                  JPEG, PNG, WEBP, GIF, BMP, SVG · max 10 MB
                </span>
              </>
            )}
          </button>
          {uploadErr && (
            <p className="mt-1.5 text-[11px] text-destructive">{uploadErr}</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            value={form.image_url}
            onChange={(e) => handleUrlChange(e.target.value)}
            onBlur={(e) => validateUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="h-10 rounded-xl bg-muted/40"
          />
          {uploadErr && (
            <p className="text-[11px] text-destructive">{uploadErr}</p>
          )}
        </div>
      )}
      
      {form.image_url && (
        <div className="mt-2 rounded-lg border border-border p-2">
          <p className="mb-2 text-[10px] text-muted-foreground">Preview:</p>
          <div className="relative h-32 w-full overflow-hidden rounded-lg bg-muted/30">
            {!previewError ? (
              <img 
                src={form.image_url} 
                alt="Preview" 
                className="h-full w-full object-cover"
                onError={() => {
                  setPreviewError(true);
                  if (tab === 'url') {
                    setUploadErr('Invalid image URL. Please check the URL and try again.');
                  }
                }}
                onLoad={() => {
                  setPreviewError(false);
                  setUploadErr(null);
                }}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                <span className="text-xs text-muted-foreground">Preview not available</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AnnouncementRow Component ──────────────────────────────────────────────

function AnnouncementRow({
  item,
  onEdit,
  onDelete,
}: {
  item: Announcement;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isPast = new Date(item.announcement_datetime) < new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="group flex items-start gap-4 rounded-2xl border border-border bg-card px-4 py-3 transition hover:border-foreground/20 hover:shadow-sm"
    >
      {/* thumbnail */}
      <div className="mt-0.5 h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/30">
        {item.image_url ? (
          <AnnouncementImage url={item.image_url} className="h-full w-full" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-foreground">{item.title}</h3>
          <Badge
            variant="outline"
            className={cn(
              'rounded-full border text-[10px]',
              isPast
                ? 'border-border bg-muted/40 text-muted-foreground'
                : 'border-primary/30 bg-primary/5 text-primary'
            )}
          >
            {isPast ? 'Past' : 'Active'}
          </Badge>
          {item.image_url && (
            <Badge variant="outline" className="rounded-full border-border text-[10px] bg-muted/40">
              <ImageIcon className="mr-1 h-2 w-2" />
              Has image
            </Badge>
          )}
        </div>

        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span>{new Date(item.announcement_datetime).toLocaleString()}</span>
        </div>

        {item.description && (
          <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">{item.description}</p>
        )}
      </div>

      {/* actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 rounded-lg px-2 text-[11px]">
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-7 rounded-lg px-2 text-[11px] text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Announcement | null>(null);
  const [deleteItem, setDeleteItem] = useState<Announcement | null>(null);
  const [form, setForm] = useState<AForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 8;

  useEffect(() => {
    load();
  }, [currentPage]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { count } = await supabase
        .from('announcements')
        .select('*', { count: 'exact', head: true });
      setTotalCount(count || 0);
      
      const from = (currentPage - 1) * itemsPerPage;
      const { data, error: e } = await supabase
        .from('announcements')
        .select('*')
        .order('announcement_datetime', { ascending: false })
        .range(from, from + itemsPerPage - 1);
      
      if (e) throw e;
      setItems((data || []) as Announcement[]);
    } catch (err: any) {
      console.error('Load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter(
      (i) => i.title.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q)
    );
  }, [items, query]);

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const openCreate = () => {
    setEditItem(null);
    setForm(emptyForm);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (item: Announcement) => {
    setEditItem(item);
    setForm({
      title: item.title,
      description: item.description ?? '',
      announcement_datetime: item.announcement_datetime
        ? new Date(item.announcement_datetime).toISOString().slice(0, 16)
        : '',
      image_url: item.image_url ?? '',
    });
    setError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!form.title || !form.announcement_datetime) {
        throw new Error('Title and date are required.');
      }
      
      const payload = {
        title: form.title,
        description: form.description || null,
        announcement_datetime: new Date(form.announcement_datetime).toISOString(),
        image_url: form.image_url || null,
      };
      
      if (editItem) {
        const { error: e } = await supabase
          .from('announcements')
          .update(payload)
          .eq('id', editItem.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from('announcements').insert(payload);
        if (e) throw e;
      }
      
      setShowModal(false);
      setCurrentPage(1);
      await load();
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', deleteItem.id);
      if (error) throw error;
      setDeleteItem(null);
      await load();
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Content"
        title="Announcements"
        description="Publish notices and updates for museum visitors."
        actions={
          <Button onClick={openCreate} className="rounded-xl">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New announcement
          </Button>
        }
      />
      {/* Error display */}
      {error && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search announcements…"
          className="w-full sm:w-64 rounded-xl bg-muted/40"
        />
        <span className="text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'announcement' : 'announcements'}</span>
      </div>

      {/* ── list ── */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: itemsPerPage }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card">
          <EmptyState
            icon={<Megaphone className="h-5 w-5" />}
            title={query ? 'No matches found' : 'No announcements yet'}
            description={query ? 'Try a different search term.' : 'Create your first announcement to keep visitors informed.'}
            action={!query && (
              <Button onClick={openCreate} variant="outline" className="rounded-xl">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New announcement
              </Button>
            )}
          />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {filtered.map((item) => (
                <AnnouncementRow
                  key={item.id}
                  item={item}
                  onEdit={() => openEdit(item)}
                  onDelete={() => setDeleteItem(item)}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <span className="text-xs text-muted-foreground tabular-nums">
                {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, totalCount)} of{' '}
                {totalCount} announcements
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline" size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="h-8 rounded-lg"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>

                {/* page numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '…' ? (
                      <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === currentPage ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(p as number)}
                        className="h-8 w-8 rounded-lg p-0 text-xs"
                      >
                        {p}
                      </Button>
                    )
                  )}

                <Button
                  variant="outline" size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="h-8 rounded-lg"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── create / edit modal ── */}
      <Modal
        open={showModal}
        onOpenChange={setShowModal}
        title={editItem ? 'Edit announcement' : 'New announcement'}
        description="Visitors will see this in their mobile app feed."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleSubmit as any} disabled={saving} className="rounded-xl">
              {saving ? 'Saving…' : editItem ? 'Save changes' : 'Publish'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Title *</Label>
            <Input 
              value={form.title} 
              onChange={(e) => setForm({ ...form, title: e.target.value })} 
              className="h-10 rounded-xl bg-muted/40"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <Clock className="h-3 w-3" /> Date &amp; Time *
            </Label>
            <Input
              type="datetime-local"
              value={form.announcement_datetime}
              onChange={(e) => setForm({ ...form, announcement_datetime: e.target.value })}
              className="h-10 rounded-xl bg-muted/40"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <AlignLeft className="h-3 w-3" /> Description
            </Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="rounded-xl bg-muted/40"
            />
          </div>

          {/* image source picker */}
          <ImageSourcePicker form={form} setForm={setForm} />

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
              {error}
            </div>
          )}
        </form>
      </Modal>

      {/* ── delete confirm ── */}
      <ConfirmModal
        open={!!deleteItem}
        onOpenChange={(o) => !o && setDeleteItem(null)}
        title="Delete announcement"
        description={`Delete "${deleteItem?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={saving}
        onConfirm={handleDelete}
      />
    </div>
  );
}