-- Add PostgreSQL trigger functions and triggers for NOTIFY events
-- These triggers emit NOTIFY events when entities are created, updated, or deleted
-- The application-level database listener will catch these events and emit application events

-- Trigger function for Account changes
CREATE OR REPLACE FUNCTION notify_account_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
BEGIN
  -- Build JSON payload with entity information
  IF TG_OP = 'DELETE' THEN
    payload := jsonb_build_object(
      'entityType', 'Account',
      'entityId', OLD.id,
      'workspaceId', OLD."workspaceId",
      'operation', 'deleted',
      'data', row_to_json(OLD)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    payload := jsonb_build_object(
      'entityType', 'Account',
      'entityId', NEW.id,
      'workspaceId', NEW."workspaceId",
      'operation', 'updated',
      'data', row_to_json(NEW)
    );
  ELSIF TG_OP = 'INSERT' THEN
    payload := jsonb_build_object(
      'entityType', 'Account',
      'entityId', NEW.id,
      'workspaceId', NEW."workspaceId",
      'operation', 'created',
      'data', row_to_json(NEW)
    );
  END IF;

  -- Emit NOTIFY event
  PERFORM pg_notify('entity_changes', payload::text);

  -- Return appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for Category changes
CREATE OR REPLACE FUNCTION notify_category_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    payload := jsonb_build_object(
      'entityType', 'Category',
      'entityId', OLD.id,
      'workspaceId', OLD."workspaceId",
      'operation', 'deleted',
      'data', row_to_json(OLD)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    payload := jsonb_build_object(
      'entityType', 'Category',
      'entityId', NEW.id,
      'workspaceId', NEW."workspaceId",
      'operation', 'updated',
      'data', row_to_json(NEW)
    );
  ELSIF TG_OP = 'INSERT' THEN
    payload := jsonb_build_object(
      'entityType', 'Category',
      'entityId', NEW.id,
      'workspaceId', NEW."workspaceId",
      'operation', 'created',
      'data', row_to_json(NEW)
    );
  END IF;

  PERFORM pg_notify('entity_changes', payload::text);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for Payee changes
CREATE OR REPLACE FUNCTION notify_payee_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    payload := jsonb_build_object(
      'entityType', 'Payee',
      'entityId', OLD.id,
      'workspaceId', OLD."workspaceId",
      'operation', 'deleted',
      'data', row_to_json(OLD)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    payload := jsonb_build_object(
      'entityType', 'Payee',
      'entityId', NEW.id,
      'workspaceId', NEW."workspaceId",
      'operation', 'updated',
      'data', row_to_json(NEW)
    );
  ELSIF TG_OP = 'INSERT' THEN
    payload := jsonb_build_object(
      'entityType', 'Payee',
      'entityId', NEW.id,
      'workspaceId', NEW."workspaceId",
      'operation', 'created',
      'data', row_to_json(NEW)
    );
  END IF;

  PERFORM pg_notify('entity_changes', payload::text);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for Transaction changes
-- Note: Transaction doesn't have direct workspaceId, so we fetch it from Account
CREATE OR REPLACE FUNCTION notify_transaction_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  workspace_id TEXT;
BEGIN
  -- Get workspaceId from Account
  IF TG_OP = 'DELETE' THEN
    SELECT "workspaceId" INTO workspace_id FROM "Account" WHERE id = OLD."accountId";
  ELSE
    SELECT "workspaceId" INTO workspace_id FROM "Account" WHERE id = NEW."accountId";
  END IF;

  IF TG_OP = 'DELETE' THEN
    payload := jsonb_build_object(
      'entityType', 'Transaction',
      'entityId', OLD.id,
      'workspaceId', workspace_id,
      'operation', 'deleted',
      'data', row_to_json(OLD)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    payload := jsonb_build_object(
      'entityType', 'Transaction',
      'entityId', NEW.id,
      'workspaceId', workspace_id,
      'operation', 'updated',
      'data', row_to_json(NEW)
    );
  ELSIF TG_OP = 'INSERT' THEN
    payload := jsonb_build_object(
      'entityType', 'Transaction',
      'entityId', NEW.id,
      'workspaceId', workspace_id,
      'operation', 'created',
      'data', row_to_json(NEW)
    );
  END IF;

  PERFORM pg_notify('entity_changes', payload::text);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS account_changes_trigger ON "Account";
CREATE TRIGGER account_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "Account"
  FOR EACH ROW
  EXECUTE FUNCTION notify_account_change();

DROP TRIGGER IF EXISTS category_changes_trigger ON "Category";
CREATE TRIGGER category_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "Category"
  FOR EACH ROW
  EXECUTE FUNCTION notify_category_change();

DROP TRIGGER IF EXISTS payee_changes_trigger ON "Payee";
CREATE TRIGGER payee_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "Payee"
  FOR EACH ROW
  EXECUTE FUNCTION notify_payee_change();

DROP TRIGGER IF EXISTS transaction_changes_trigger ON "Transaction";
CREATE TRIGGER transaction_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "Transaction"
  FOR EACH ROW
  EXECUTE FUNCTION notify_transaction_change();
