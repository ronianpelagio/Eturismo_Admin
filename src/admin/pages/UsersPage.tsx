import React, { useEffect, useMemo, useState } from 'react';
import { MoreHorizontal, Plus, ShieldCheck, ShieldOff, UserCog, Trash2, Pencil } from 'lucide-react';
import { supabase } from '../services/supabase';
import { AdminUser } from '../types';
import PageHeader from '../components/PageHeader';
import SearchBar from '../components/SearchBar';
import EmptyState from '../components/EmptyState';
import { TableSkeleton } from '../components/LoadingSkeleton';
import Modal, { ConfirmModal } from '../components/Modal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ROLES = ['user', 'admin'] as const;
const STATUSES = ['active', 'inactive'] as const;
const GENDERS = ['Male', 'Female', 'Other'] as const;

const emptyForm = { 
  email: '', 
  password: '',
  first_name: '', 
  last_name: '', 
  gender: '' as string,
  age: '' as string,
  role: 'user', 
  status: 'active' 
};

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<AdminUser | null>(null);
  const [deleteItem, setDeleteItem] = useState<AdminUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    if (e) setError(e.message);
    setUsers((data || []) as AdminUser[]);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        (u.first_name ?? '').toLowerCase().includes(q) ||
        (u.last_name ?? '').toLowerCase().includes(q) ||
        (u.role ?? '').toLowerCase().includes(q)
    );
  }, [users, query]);

  const openCreate = () => {
    setEditItem(null);
    setForm(emptyForm);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (u: AdminUser) => {
    setEditItem(u);
    setForm({
      email: u.email,
      password: '',
      first_name: u.first_name ?? '',
      last_name: u.last_name ?? '',
      gender: u.gender ?? '',
      age: u.age?.toString() ?? '',
      role: u.role ?? 'user',
      status: u.status ?? 'active',
    });
    setError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    
    try {
      // Validation
      if (!form.email) throw new Error('Email is required.');
      if (!form.first_name) throw new Error('First name is required.');
      if (!form.last_name) throw new Error('Last name is required.');
      if (!editItem && !form.password) throw new Error('Password is required for new users.');
      if (form.password && form.password.length < 6) throw new Error('Password must be at least 6 characters.');

      if (editItem) {
        // Update existing user in public.users
        const updateData: any = { 
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          gender: form.gender || null,
          age: form.age ? parseInt(form.age) : null,
          role: form.role, 
          status: form.status 
        };

        const { error: updateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', editItem.id);
        
        if (updateError) throw updateError;

        // If password is provided, update it
        if (form.password) {
          const { error: passwordError } = await supabase.auth.updateUser({
            password: form.password
          });
          
          if (passwordError) {
            console.warn('Could not update password:', passwordError.message);
          }
        }
      } else {
        // FIRST: Check if user already exists
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('email')
          .eq('email', form.email.trim().toLowerCase())
          .single();
        
        if (existingUser) {
          throw new Error('A user with this email already exists.');
        }

        // Create new user using regular signup with better error handling
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          options: {
            data: {
              first_name: form.first_name.trim(),
              last_name: form.last_name.trim(),
            },
            // Temporarily disable email confirmation to bypass SMTP issues
            emailRedirectTo: window.location.origin,
          },
        });

        if (signUpError) {
          console.error('Signup error details:', signUpError);
          throw new Error(`Signup failed: ${signUpError.message}`);
        }
        
        if (!authData.user) {
          throw new Error('User creation failed - no user returned');
        }

        // Wait for the trigger to execute
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Update the user with additional fields
        const { error: updateError } = await supabase
          .from('users')
          .update({
            gender: form.gender || null,
            age: form.age ? parseInt(form.age) : null,
            role: form.role,
            status: form.status,
          })
          .eq('id', authData.user.id);

        if (updateError) {
          console.error('Failed to update user details:', updateError);
          // Don't throw - user was created successfully
        }
      }

      setShowModal(false);
      await load();
    } catch (err: any) {
      console.error('Full error object:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setSaving(true);
    
    try {
      // Delete from public.users (cascade should handle auth.users if set up)
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', deleteItem.id);
      
      if (error) throw error;
      
      setDeleteItem(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u: AdminUser) => {
    setSaving(true);
    const newStatus = u.status === 'inactive' ? 'active' : 'inactive';
    
    const { error } = await supabase
      .from('users')
      .update({ status: newStatus })
      .eq('id', u.id);
    
    if (error) {
      setError(error.message);
    } else {
      await load();
    }
    
    setSaving(false);
  };

  const toggleRole = async (u: AdminUser) => {
    setSaving(true);
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', u.id);
    
    if (error) {
      setError(error.message);
    } else {
      await load();
    }
    
    setSaving(false);
  };

  const getFullName = (user: AdminUser) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.first_name || user.last_name || null;
  };

  const getInitial = (user: AdminUser) => {
    return (user.first_name?.[0] || user.last_name?.[0] || user.email[0]).toUpperCase();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Access Control"
        title="Users"
        description="Manage visitor accounts and admin access permissions."
        actions={
          <Button onClick={openCreate} className="rounded-xl">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add user
          </Button>
        }
      />

      <Card className="rounded-2xl border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users…" className="w-full sm:w-64" />
          <span className="text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'user' : 'users'}</span>
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={query ? 'No matching users' : 'No users yet'}
            description={query ? 'Try a different search term.' : 'Add your first user to get started.'}
            action={!query && (
              <Button onClick={openCreate} variant="outline" className="rounded-xl">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add user
              </Button>
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/40 backdrop-blur-xl">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">User</th>
                  <th className="px-5 py-2.5 font-medium">Role</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium">Joined</th>
                  <th className="px-5 py-2.5 font-medium w-12 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((u) => (
                  <tr key={u.id} className="group transition hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted text-xs font-semibold uppercase text-foreground">
                          {getInitial(u)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">
                            {getFullName(u) || <span className="text-muted-foreground">No name</span>}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge
                        variant="outline"
                        className={`rounded-full border-border text-[10px] uppercase tracking-wider ${
                          u.role === 'admin' ? 'bg-foreground text-background' : 'bg-muted/40 text-muted-foreground'
                        }`}
                      >
                        {u.role || 'user'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            u.status === 'inactive' ? 'bg-destructive' : 'bg-foreground'
                          }`}
                        />
                        {u.status || 'active'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 rounded-xl border-border">
                          <DropdownMenuItem onClick={() => openEdit(u)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleRole(u)} disabled={saving}>
                            <UserCog className="mr-2 h-3.5 w-3.5" />
                            {u.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleStatus(u)} disabled={saving}>
                            {u.status === 'inactive' ? (
                              <>
                                <ShieldCheck className="mr-2 h-3.5 w-3.5" /> Activate
                              </>
                            ) : (
                              <>
                                <ShieldOff className="mr-2 h-3.5 w-3.5" /> Deactivate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setDeleteItem(u)} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={showModal}
        onOpenChange={setShowModal}
        title={editItem ? 'Edit user' : 'Add user'}
        description={editItem ? 'Update the user\'s details and permissions.' : 'Create a new account for an admin or visitor.'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleSubmit as any} disabled={saving} className="rounded-xl">
              {saving ? 'Saving…' : editItem ? 'Save changes' : 'Create user'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Email *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="user@example.com"
              className="h-10 rounded-xl bg-muted/40"
              disabled={!!editItem}
              required
            />
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs">
              {editItem ? 'New password (leave blank to keep current)' : 'Password *'}
            </Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editItem ? 'New password' : 'Min. 6 characters'}
              className="h-10 rounded-xl bg-muted/40"
              required={!editItem}
              minLength={6}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">First name *</Label>
              <Input
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                placeholder="First name"
                className="h-10 rounded-xl bg-muted/40"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Last name *</Label>
              <Input
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                placeholder="Last name"
                className="h-10 rounded-xl bg-muted/40"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger className="h-10 rounded-xl bg-muted/40">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Age</Label>
              <Input
                type="number"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                placeholder="Age"
                min="0"
                className="h-10 rounded-xl bg-muted/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="h-10 rounded-xl bg-muted/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="h-10 rounded-xl bg-muted/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
              {error}
            </div>
          )}
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteItem}
        onOpenChange={(o) => !o && setDeleteItem(null)}
        title="Remove user"
        description={`Remove ${deleteItem?.email ?? 'this user'} from the database? This cannot be undone.`}
        confirmLabel="Remove user"
        destructive
        loading={saving}
        onConfirm={handleDelete}
      />
    </div>
  );
}