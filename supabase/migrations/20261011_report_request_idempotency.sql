ALTER TABLE public.recommendations
  ADD COLUMN IF NOT EXISTS source_session_id uuid
  REFERENCES public.sessions(id) ON DELETE SET NULL;

ALTER TABLE public.premium_requests
  ADD COLUMN IF NOT EXISTS source_recommendation_id uuid
  REFERENCES public.recommendations(id) ON DELETE SET NULL;

ALTER TABLE public.daily_tasks
  ADD COLUMN IF NOT EXISTS source_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_recommendations_source_session_child
  ON public.recommendations (source_session_id, child_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_premium_requests_source_recommendation
  ON public.premium_requests (source_recommendation_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_tasks_session_child_source
  ON public.daily_tasks (session_id, child_id, source_key);

CREATE OR REPLACE FUNCTION public.request_recommendation_session_atomic(
  p_recommendation_id uuid,
  p_parent_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_parent_id uuid;
  v_child_name text;
  v_full_name text;
  v_phone text;
  v_subject text;
  v_reason text;
  v_status text;
  v_request_id uuid;
BEGIN
  SELECT
    c.parent_id,
    c.first_name,
    p.full_name,
    p.phone,
    r.subject,
    r.reason,
    r.status
  INTO
    v_child_parent_id,
    v_child_name,
    v_full_name,
    v_phone,
    v_subject,
    v_reason,
    v_status
  FROM public.recommendations AS r
  LEFT JOIN public.children AS c ON c.id = r.child_id
  LEFT JOIN public.parents AS p ON p.id = c.parent_id
  WHERE r.id = p_recommendation_id
  FOR UPDATE OF r;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'recommendation_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_child_parent_id IS DISTINCT FROM p_parent_id THEN
    RAISE EXCEPTION 'recommendation_not_owned' USING ERRCODE = 'P0001';
  END IF;

  IF v_status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'recommendation_not_open' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.premium_requests (
    product,
    full_name,
    phone,
    goal,
    status,
    source_recommendation_id
  )
  VALUES (
    'motabaa',
    v_full_name,
    v_phone,
    'جلسة تقوية فردية لـ' || CASE WHEN COALESCE(v_child_name, '') <> '' THEN ' ' || v_child_name ELSE '' END
      || ' — ' || COALESCE(v_subject, '') || ': ' || v_reason,
    'new',
    p_recommendation_id
  )
  RETURNING id INTO v_request_id;

  UPDATE public.recommendations
  SET status = 'actioned'
  WHERE id = p_recommendation_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_recommendation_session_atomic(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_recommendation_session_atomic(uuid, uuid)
  TO service_role;
