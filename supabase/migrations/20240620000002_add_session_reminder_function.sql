-- Create a function to generate session reminders
CREATE OR REPLACE FUNCTION create_session_reminders()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
  babalawo_user_id UUID;
  session_datetime TIMESTAMP;
  user_name TEXT;
  babalawo_name TEXT;
BEGIN
  -- Only create reminders for confirmed sessions
  IF NEW.status != 'confirmed' THEN
    RETURN NEW;
  END IF;
  
  -- Get the session datetime
  session_datetime := (NEW.session_date || ' ' || NEW.start_time)::TIMESTAMP;
  
  -- Get user and babalawo details
  SELECT u.id, p.full_name INTO user_id, user_name
  FROM users u
  LEFT JOIN profiles p ON p.user_id = u.id
  WHERE u.id = NEW.user_id;
  
  SELECT b.user_id, p.full_name INTO babalawo_user_id, babalawo_name
  FROM babalawos b
  LEFT JOIN profiles p ON p.user_id = b.user_id
  WHERE b.id = NEW.babalawo_id;
  
  -- Create reminders in the reminders table
  -- 1 hour reminder for user
  INSERT INTO reminders (
    user_id,
    type,
    title,
    message,
    reminder_time,
    related_id,
    status
  ) VALUES (
    user_id,
    'session',
    '1 Hour Reminder: Upcoming Session',
    'Your session with ' || COALESCE(babalawo_name, 'your babalawo') || ' starts in 1 hour.',
    session_datetime - INTERVAL '1 hour',
    NEW.id,
    'pending'
  );
  
  -- 30 minutes reminder for user
  INSERT INTO reminders (
    user_id,
    type,
    title,
    message,
    reminder_time,
    related_id,
    status
  ) VALUES (
    user_id,
    'session',
    '30 Minutes Reminder: Upcoming Session',
    'Your session with ' || COALESCE(babalawo_name, 'your babalawo') || ' starts in 30 minutes.',
    session_datetime - INTERVAL '30 minutes',
    NEW.id,
    'pending'
  );
  
  -- 10 minutes reminder for user
  INSERT INTO reminders (
    user_id,
    type,
    title,
    message,
    reminder_time,
    related_id,
    status
  ) VALUES (
    user_id,
    'session',
    '10 Minutes Reminder: Upcoming Session',
    'Your session with ' || COALESCE(babalawo_name, 'your babalawo') || ' starts in 10 minutes. Please prepare to join.',
    session_datetime - INTERVAL '10 minutes',
    NEW.id,
    'pending'
  );
  
  -- 1 hour reminder for babalawo
  INSERT INTO reminders (
    user_id,
    type,
    title,
    message,
    reminder_time,
    related_id,
    status
  ) VALUES (
    babalawo_user_id,
    'session',
    '1 Hour Reminder: Upcoming Session',
    'Your session with ' || COALESCE(user_name, 'a client') || ' starts in 1 hour.',
    session_datetime - INTERVAL '1 hour',
    NEW.id,
    'pending'
  );
  
  -- 30 minutes reminder for babalawo
  INSERT INTO reminders (
    user_id,
    type,
    title,
    message,
    reminder_time,
    related_id,
    status
  ) VALUES (
    babalawo_user_id,
    'session',
    '30 Minutes Reminder: Upcoming Session',
    'Your session with ' || COALESCE(user_name, 'a client') || ' starts in 30 minutes.',
    session_datetime - INTERVAL '30 minutes',
    NEW.id,
    'pending'
  );
  
  -- 10 minutes reminder for babalawo
  INSERT INTO reminders (
    user_id,
    type,
    title,
    message,
    reminder_time,
    related_id,
    status
  ) VALUES (
    babalawo_user_id,
    'session',
    '10 Minutes Reminder: Upcoming Session',
    'Your session with ' || COALESCE(user_name, 'a client') || ' starts in 10 minutes. Please prepare to join.',
    session_datetime - INTERVAL '10 minutes',
    NEW.id,
    'pending'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on the sessions table
DROP TRIGGER IF EXISTS after_insert_or_update_session ON sessions;
CREATE TRIGGER after_insert_or_update_session
  AFTER INSERT OR UPDATE OF status ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION create_session_reminders();

-- Create a function to process reminders and create notifications
CREATE OR REPLACE FUNCTION process_due_reminders()
RETURNS void AS $$
DECLARE
  reminder_record RECORD;
BEGIN
  -- Find reminders that are due but not yet processed
  FOR reminder_record IN
    SELECT * FROM reminders
    WHERE 
      status = 'pending' AND 
      reminder_time <= NOW()
  LOOP
    -- Create a notification for this reminder
    INSERT INTO notifications (
      type,
      title,
      message,
      recipient_id,
      related_id,
      read,
      action_url,
      action_label
    ) VALUES (
      reminder_record.type,
      reminder_record.title,
      reminder_record.message,
      reminder_record.user_id,
      reminder_record.related_id,
      false,
      CASE 
        WHEN reminder_record.type = 'session' THEN '/session/' || reminder_record.related_id
        ELSE NULL
      END,
      CASE 
        WHEN reminder_record.type = 'session' THEN 'Join Session'
        ELSE NULL
      END
    );
    
    -- Mark the reminder as processed
    UPDATE reminders
    SET status = 'processed'
    WHERE id = reminder_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;