ALTER TABLE public.calls DROP CONSTRAINT IF EXISTS calls_status_check;

ALTER TABLE public.calls
ADD CONSTRAINT calls_status_check
CHECK (status IN ('calling', 'accepted', 'ongoing', 'ended', 'missed', 'rejected', 'completed'));

CREATE INDEX IF NOT EXISTS idx_calls_receiver_status_started
ON public.calls (receiver_id, status, started_at DESC)
WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_calls_participants_status
ON public.calls (caller_id, receiver_id, status)
WHERE ended_at IS NULL;