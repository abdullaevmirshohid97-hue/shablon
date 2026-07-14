'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setStatus(error ? 'error' : 'sent');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold">Tizimga kirish</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="email@company.uz"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          className="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50"
        >
          {status === 'sending' ? 'Yuborilmoqda...' : 'Kirish havolasini yuborish'}
        </button>
      </form>
      {status === 'sent' && (
        <p className="text-sm text-emerald-600">Emailingizga kirish havolasi yuborildi.</p>
      )}
      {status === 'error' && (
        <p className="text-sm text-red-600">Xatolik yuz berdi, qayta urinib ko&apos;ring.</p>
      )}
    </main>
  );
}
