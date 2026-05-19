
CREATE TABLE public.batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  batch_name TEXT,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  successful_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  tx_hash TEXT,
  gas_used_usdc NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_batches_wallet ON public.batches (lower(wallet_address), created_at DESC);

CREATE TABLE public.recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipients_batch ON public.recipients (batch_id);

ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;

-- This app authenticates users by EVM wallet (not Supabase Auth), so RLS allows
-- public read/write. Filtering by wallet_address is enforced in the client query.
CREATE POLICY "public_read_batches" ON public.batches FOR SELECT USING (true);
CREATE POLICY "public_insert_batches" ON public.batches FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_batches" ON public.batches FOR UPDATE USING (true);

CREATE POLICY "public_read_recipients" ON public.recipients FOR SELECT USING (true);
CREATE POLICY "public_insert_recipients" ON public.recipients FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_recipients" ON public.recipients FOR UPDATE USING (true);
