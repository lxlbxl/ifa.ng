-- Create email_settings table for admin configuration
CREATE TABLE IF NOT EXISTS email_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  smtp_host VARCHAR(255) NOT NULL,
  smtp_port INTEGER NOT NULL,
  smtp_username VARCHAR(255) NOT NULL,
  smtp_password VARCHAR(255) NOT NULL,
  smtp_secure BOOLEAN NOT NULL DEFAULT TRUE,
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  variables JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Insert default email templates
INSERT INTO email_templates (name, subject, body, variables)
VALUES 
  (
    'session_reminder', 
    'Reminder: Your Session is Starting Soon', 
    '<p>Dear {{user_name}},</p>
    <p>This is a reminder that your session with {{babalawo_name}} is scheduled to start in {{time_until}} minutes.</p>
    <p>Please click the button below to join the session:</p>
    <p><a href="{{session_url}}" style="background-color: #7b61ff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Join Session</a></p>
    <p>If you have any questions, please contact our support team.</p>
    <p>Best regards,<br>IFA.ng Team</p>',
    '{"user_name": "User''s name", "babalawo_name": "Babalawo''s name", "time_until": "Time until session in minutes", "session_url": "URL to join the session"}'
  ),
  (
    'booking_confirmation', 
    'Your Booking Confirmation', 
    '<p>Dear {{user_name}},</p>
    <p>Your booking with {{babalawo_name}} has been confirmed for {{session_date}} at {{session_time}}.</p>
    <p>You will receive a reminder before the session starts.</p>
    <p>Best regards,<br>IFA.ng Team</p>',
    '{"user_name": "User''s name", "babalawo_name": "Babalawo''s name", "session_date": "Date of the session", "session_time": "Time of the session"}'
  ),
  (
    'payment_confirmation', 
    'Payment Confirmation', 
    '<p>Dear {{user_name}},</p>
    <p>We have received your payment of {{amount}} for the session with {{babalawo_name}}.</p>
    <p>Transaction ID: {{transaction_id}}</p>
    <p>Best regards,<br>IFA.ng Team</p>',
    '{"user_name": "User''s name", "amount": "Payment amount", "babalawo_name": "Babalawo''s name", "transaction_id": "Transaction ID"}'
  ),
  (
    'withdrawal_request', 
    'Withdrawal Request Confirmation', 
    '<p>Dear {{babalawo_name}},</p>
    <p>We have received your withdrawal request for {{amount}}.</p>
    <p>Your request is being processed and you will be notified once the funds have been transferred to your bank account.</p>
    <p>Best regards,<br>IFA.ng Team</p>',
    '{"babalawo_name": "Babalawo''s name", "amount": "Withdrawal amount"}'
  ),
  (
    'ritual_reminder', 
    'Ritual Reminder', 
    '<p>Dear {{user_name}},</p>
    <p>This is a reminder for the {{ritual_type}} ritual prescribed by {{babalawo_name}}:</p>
    <p><strong>{{ritual_title}}</strong></p>
    <p>{{ritual_description}}</p>
    <p>Due date: {{due_date}}</p>
    <p>Best regards,<br>IFA.ng Team</p>',
    '{"user_name": "User''s name", "ritual_type": "Type of ritual", "babalawo_name": "Babalawo''s name", "ritual_title": "Title of the ritual", "ritual_description": "Description of the ritual", "due_date": "Due date for the ritual"}'
  );

-- Create function to send email
CREATE OR REPLACE FUNCTION send_email(
  p_to_email VARCHAR,
  p_template_name VARCHAR,
  p_variables JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
  v_template email_templates%ROWTYPE;
  v_settings email_settings%ROWTYPE;
  v_subject VARCHAR;
  v_body TEXT;
  v_key VARCHAR;
  v_value VARCHAR;
BEGIN
  -- Get the email template
  SELECT * INTO v_template
  FROM email_templates
  WHERE name = p_template_name;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Email template % not found', p_template_name;
  END IF;
  
  -- Get the email settings
  SELECT * INTO v_settings
  FROM email_settings
  WHERE enabled = TRUE
  ORDER BY updated_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No enabled email settings found';
  END IF;
  
  -- Prepare the subject and body
  v_subject := v_template.subject;
  v_body := v_template.body;
  
  -- Replace variables in subject and body
  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_variables)
  LOOP
    v_subject := REPLACE(v_subject, '{{' || v_key || '}}', v_value);
    v_body := REPLACE(v_body, '{{' || v_key || '}}', v_value);
  END LOOP;
  
  -- In a real implementation, this would send the email using the SMTP settings
  -- For now, we'll just log the email details
  INSERT INTO email_logs (
    to_email,
    subject,
    body,
    template_name,
    variables,
    status,
    error_message
  ) VALUES (
    p_to_email,
    v_subject,
    v_body,
    p_template_name,
    p_variables,
    'pending',
    NULL
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO email_logs (
      to_email,
      subject,
      body,
      template_name,
      variables,
      status,
      error_message
    ) VALUES (
      p_to_email,
      v_subject,
      v_body,
      p_template_name,
      p_variables,
      'error',
      SQLERRM
    );
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  template_name VARCHAR(100) NOT NULL,
  variables JSONB,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'sent', 'error')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);