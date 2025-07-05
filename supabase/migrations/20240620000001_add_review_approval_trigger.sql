-- Create a trigger function to automatically approve or flag reviews based on rating
CREATE OR REPLACE FUNCTION auto_approve_reviews()
RETURNS TRIGGER AS $$
BEGIN
  -- If rating is 3 or higher, automatically approve
  IF NEW.rating >= 3 THEN
    NEW.status := 'approved';
  ELSE
    -- If rating is less than 3, set to pending for admin review
    NEW.status := 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on the reviews table
DROP TRIGGER IF EXISTS before_insert_review ON reviews;
CREATE TRIGGER before_insert_review
  BEFORE INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION auto_approve_reviews();

-- Create a function to notify users and babalawos about new reviews
CREATE OR REPLACE FUNCTION notify_on_review()
RETURNS TRIGGER AS $$
DECLARE
  babalawo_user_id UUID;
  babalawo_name TEXT;
BEGIN
  -- Get the babalawo's user_id and name
  SELECT b.user_id, p.full_name INTO babalawo_user_id, babalawo_name
  FROM babalawos b
  LEFT JOIN profiles p ON p.user_id = b.user_id
  WHERE b.id = NEW.babalawo_id;
  
  -- Create notification for the babalawo
  INSERT INTO notifications (
    type,
    title,
    message,
    recipient_id,
    related_id,
    read
  ) VALUES (
    'review',
    'New Review Received',
    'You have received a ' || NEW.rating || '-star review from a client.',
    babalawo_user_id,
    NEW.id,
    false
  );
  
  -- If review is pending (low rating), notify admins
  IF NEW.status = 'pending' THEN
    -- Get all admin user IDs
    FOR admin_id IN (SELECT user_id FROM user_roles WHERE role = 'admin') LOOP
      INSERT INTO notifications (
        type,
        title,
        message,
        recipient_id,
        related_id,
        read
      ) VALUES (
        'review',
        'Review Needs Approval',
        'A ' || NEW.rating || '-star review for ' || COALESCE(babalawo_name, 'a babalawo') || ' requires approval.',
        admin_id,
        NEW.id,
        false
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on the reviews table
DROP TRIGGER IF EXISTS after_insert_review ON reviews;
CREATE TRIGGER after_insert_review
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_review();