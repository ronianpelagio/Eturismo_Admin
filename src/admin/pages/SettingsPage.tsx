import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Check } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmModal } from '../components/Modal';

export default function SettingsPage() {
  const [form, setForm] = useState({
    museumName: 'ETorismo',
    defaultLanguage: 'English',
    timezone: 'UTC',
    notifications: true,
  });
  const [showModal, setShowModal] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem('etorismoAdminSettings');
      if (v) setForm(JSON.parse(v));
    } catch {}
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem('etorismoAdminSettings', JSON.stringify(form));
    } catch {}
    setShowModal(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2600);
  };

  return (
    <div>
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Control application preferences and system defaults."
        actions={
          <Button onClick={() => setShowModal(true)} className="rounded-xl">
            <Save className="mr-1.5 h-3.5 w-3.5" /> Save changes
          </Button>
        }
      />

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="rounded-xl border border-border bg-card p-1">
          <TabsTrigger value="general" className="rounded-lg text-xs data-[state=active]:bg-muted">
            General
          </TabsTrigger>
          <TabsTrigger value="preferences" className="rounded-lg text-xs data-[state=active]:bg-muted">
            Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="rounded-2xl border-border bg-card p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Museum name</Label>
                <Input
                  value={form.museumName}
                  onChange={(e) => setForm({ ...form, museumName: e.target.value })}
                  className="h-10 rounded-xl bg-muted/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Default language</Label>
                <Input
                  value={form.defaultLanguage}
                  onChange={(e) => setForm({ ...form, defaultLanguage: e.target.value })}
                  className="h-10 rounded-xl bg-muted/40"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Timezone</Label>
                <Input
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  className="h-10 rounded-xl bg-muted/40"
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <Card className="rounded-2xl border-border bg-card p-6">
            <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <Label className="text-sm font-medium text-foreground">Notifications</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Email me when new ratings or accounts are created.
                </p>
              </div>
              <Switch
                checked={form.notifications}
                onCheckedChange={(v) => setForm({ ...form, notifications: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-4 pt-4">
              <div>
                <Label className="text-sm font-medium text-foreground">Compact density</Label>
                <p className="mt-1 text-xs text-muted-foreground">Reduce padding across tables and cards.</p>
              </div>
              <Switch />
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {saved && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-6 right-6 flex items-center gap-2 rounded-xl border border-border bg-popover px-4 py-2.5 text-sm shadow-2xl"
        >
          <Check className="h-3.5 w-3.5" /> Settings saved
        </motion.div>
      )}

      <ConfirmModal
        open={showModal}
        onOpenChange={setShowModal}
        title="Save settings"
        description={`Apply these changes to ${form.museumName}?`}
        confirmLabel="Confirm & save"
        onConfirm={handleSave}
      />
    </div>
  );
}
