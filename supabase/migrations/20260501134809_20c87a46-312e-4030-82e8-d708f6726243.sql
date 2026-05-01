CREATE OR REPLACE FUNCTION public.set_api_keys_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  public_key TEXT NOT NULL UNIQUE,
  secret_key_hash TEXT NOT NULL,
  secret_key_preview TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read:posts','read:profiles','read:users']::text[],
  allowed_origins TEXT[] DEFAULT ARRAY[]::text[],
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_user ON public.api_keys(user_id);
CREATE INDEX idx_api_keys_public ON public.api_keys(public_key);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view their api keys"
ON public.api_keys FOR SELECT
TO authenticated
USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can create api keys"
ON public.api_keys FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update their api keys"
ON public.api_keys FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete their api keys"
ON public.api_keys FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE TABLE public.api_request_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  origin TEXT,
  response_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_logs_key ON public.api_request_logs(api_key_id);
CREATE INDEX idx_api_logs_created ON public.api_request_logs(created_at DESC);

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view their api logs"
ON public.api_request_logs FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.api_keys k WHERE k.id = api_request_logs.api_key_id AND k.user_id = auth.uid()));

CREATE TRIGGER trg_api_keys_updated_at
BEFORE UPDATE ON public.api_keys
FOR EACH ROW
EXECUTE FUNCTION public.set_api_keys_updated_at();