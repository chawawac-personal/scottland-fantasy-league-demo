CREATE OR REPLACE FUNCTION cast_poll_vote(p_poll_id UUID, p_option TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user    UUID := auth.uid();
  v_existing TEXT;
  v_votes   JSONB;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;

  SELECT option INTO v_existing
  FROM poll_votes WHERE poll_id = p_poll_id AND user_id = v_user;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already voted', 'choice', v_existing);
  END IF;

  INSERT INTO poll_votes (poll_id, user_id, option) VALUES (p_poll_id, v_user, p_option);

  UPDATE polls
  SET votes = jsonb_set(
    COALESCE(votes, '{}'::jsonb),
    ARRAY[p_option],
    to_jsonb(COALESCE((votes ->> p_option)::int, 0) + 1)
  )
  WHERE id = p_poll_id
  RETURNING votes INTO v_votes;

  RETURN jsonb_build_object('ok', true, 'votes', v_votes, 'choice', p_option);
END;
$$;

GRANT EXECUTE ON FUNCTION cast_poll_vote TO authenticated;
