-- Circle membership: role column + RLS so joins and member lists work

ALTER TABLE public.circle_members
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member';

ALTER TABLE public.circle_members
  DROP CONSTRAINT IF EXISTS circle_members_role_check;

ALTER TABLE public.circle_members
  ADD CONSTRAINT circle_members_role_check
  CHECK (role IN ('member', 'admin'));

COMMENT ON COLUMN public.circle_members.role IS 'member | admin (circle creator)';

-- Avoid recursive RLS on circle_members SELECT
CREATE OR REPLACE FUNCTION public.is_circle_member(p_circle_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.circle_members
    WHERE circle_id = p_circle_id
      AND user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_circle_member(uuid) TO authenticated;

ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can join circles" ON public.circle_members;
CREATE POLICY "Users can join circles"
  ON public.circle_members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view circle members" ON public.circle_members;
CREATE POLICY "Users can view circle members"
  ON public.circle_members
  FOR SELECT
  TO authenticated
  USING (public.is_circle_member(circle_id));

DROP POLICY IF EXISTS "Users can leave circles" ON public.circle_members;
CREATE POLICY "Users can leave circles"
  ON public.circle_members
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Circles: allow authenticated users to look up by invite code / read circles they belong to
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read circles" ON public.circles;
CREATE POLICY "Users can read circles"
  ON public.circles
  FOR SELECT
  TO authenticated
  USING (true); -- needed for invite-code join lookup; codes are the gate

DROP POLICY IF EXISTS "Users can create circles" ON public.circles;
CREATE POLICY "Users can create circles"
  ON public.circles
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());
