-- Payouts must follow approval and include a bank reference. This keeps the
-- admin UI's two-step flow enforceable at the database boundary as well.
CREATE OR REPLACE FUNCTION public.admin_process_withdrawal(
  p_id uuid,
  p_action text,
  p_reference text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.withdrawal_requests%ROWTYPE;
  v_reference text := NULLIF(btrim(p_reference), '');
  v_notification_action text := p_action;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT * INTO w FROM public.withdrawal_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;

  IF p_action = 'approve' THEN
    IF w.status <> 'pending' THEN RAISE EXCEPTION 'Only pending requests can be approved'; END IF;
    UPDATE public.withdrawal_requests
       SET status = 'approved', processed_by = auth.uid(), processed_at = now(), admin_note = p_note
     WHERE id = p_id;
  ELSIF p_action = 'reject' THEN
    IF w.status NOT IN ('pending', 'approved') THEN RAISE EXCEPTION 'Cannot reject a % request', w.status; END IF;
    IF p_note IS NULL OR length(btrim(p_note)) < 3 THEN RAISE EXCEPTION 'A rejection reason is required'; END IF;
    UPDATE public.babalawo_wallets
       SET held_balance = held_balance - w.amount, available_balance = available_balance + w.amount,
           updated_at = now()
     WHERE babalawo_id = w.babalawo_id;
    INSERT INTO public.babalawo_ledger(babalawo_id, entry_type, amount, withdrawal_id, note)
      VALUES (w.babalawo_id, 'withdrawal_reject', w.amount, p_id, btrim(p_note));
    UPDATE public.withdrawal_requests
       SET status = 'rejected', processed_by = auth.uid(), processed_at = now(), admin_note = btrim(p_note)
     WHERE id = p_id;
  ELSIF p_action = 'mark_paid' THEN
    IF w.status <> 'approved' THEN RAISE EXCEPTION 'Only approved requests can be paid'; END IF;
    IF v_reference IS NULL THEN RAISE EXCEPTION 'A bank transfer reference is required'; END IF;
    UPDATE public.babalawo_wallets
       SET held_balance = held_balance - w.amount, lifetime_paid_out = lifetime_paid_out + w.amount,
           updated_at = now()
     WHERE babalawo_id = w.babalawo_id;
    INSERT INTO public.babalawo_ledger(babalawo_id, entry_type, amount, withdrawal_id, note)
      VALUES (w.babalawo_id, 'withdrawal_paid', w.amount, p_id, v_reference);
    INSERT INTO public.payouts(babalawo_id, amount, method, reference, status)
      VALUES (w.babalawo_id, w.amount, 'bank_transfer', v_reference, 'paid');
    UPDATE public.withdrawal_requests
       SET status = 'completed', payout_reference = v_reference, processed_by = auth.uid(), processed_at = now(), admin_note = p_note
     WHERE id = p_id;
    v_notification_action := 'paid';
  ELSE
    RAISE EXCEPTION 'Unknown action %', p_action;
  END IF;

  PERFORM public.create_notification(
    w.babalawo_id,
    'withdrawal_' || v_notification_action,
    'Withdrawal update',
    'Your withdrawal request was updated: ' || v_notification_action || '.',
    jsonb_build_object('withdrawal_id', p_id),
    'normal'
  );
END;
$$;
