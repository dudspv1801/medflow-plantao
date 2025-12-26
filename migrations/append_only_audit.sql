CREATE FUNCTION audit_prevent_modify() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only; updates/deletes are forbidden.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_prevent_update
BEFORE UPDATE ON "AuditLog"
FOR EACH ROW EXECUTE PROCEDURE audit_prevent_modify();

CREATE TRIGGER audit_prevent_delete
BEFORE DELETE ON "AuditLog"
FOR EACH ROW EXECUTE PROCEDURE audit_prevent_modify();
