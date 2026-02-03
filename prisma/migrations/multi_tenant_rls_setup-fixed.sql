-- ============================================
-- MULTI-TENANT ARCHITECTURE WITH RLS
-- ============================================
-- SQL міграція для створення Multi-tenant архітектури
-- з Row Level Security (RLS) та тригерним дублюванням
-- База даних: Neon (PostgreSQL)

-- ============================================
-- 1. РОЗШИРЕННЯ ДЛЯ UUID
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. ФУНКЦІЯ ДЛЯ ВСТАНОВЛЕННЯ business_id В СЕСІЇ
-- ============================================
CREATE OR REPLACE FUNCTION set_current_business_id(business_uuid UUID)
RETURNS VOID AS $func$
BEGIN
  PERFORM set_config('app.current_business_id', business_uuid::TEXT, false);
END;
$func$ LANGUAGE plpgsql;

-- ============================================
-- 3. ФУНКЦІЯ ДЛЯ ОТРИМАННЯ поточного business_id
-- ============================================
CREATE OR REPLACE FUNCTION get_current_business_id()
RETURNS UUID AS $func$
BEGIN
  RETURN NULLIF(current_setting('app.current_business_id', true), '')::UUID;
END;
$func$ LANGUAGE plpgsql;

-- ============================================
-- 4. ADMIN CONTROL CENTER (Архів)
-- ============================================
CREATE TABLE IF NOT EXISTS admin_control_center (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id TEXT NOT NULL,
  business_phone TEXT,
  business_email TEXT,
  business_name TEXT,
  client_id TEXT,
  client_name TEXT,
  client_phone TEXT,
  action_type TEXT NOT NULL DEFAULT 'client_created',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Індекси
CREATE INDEX IF NOT EXISTS idx_admin_control_business_id ON admin_control_center(business_id);
CREATE INDEX IF NOT EXISTS idx_admin_control_client_phone ON admin_control_center(client_phone);
CREATE INDEX IF NOT EXISTS idx_admin_control_business_phone ON admin_control_center(business_phone);
CREATE INDEX IF NOT EXISTS idx_admin_control_created_at ON admin_control_center(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_control_action_type ON admin_control_center(action_type);

-- ============================================
-- 5. ROW LEVEL SECURITY ДЛЯ clients
-- ============================================
ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clients_business_isolation ON "Client";
CREATE POLICY clients_business_isolation ON "Client"
  FOR ALL
  USING (
    "businessId" = get_current_business_id()::TEXT
    OR get_current_business_id() IS NULL
  );

-- ============================================
-- 6. RLS ДЛЯ appointments
-- ============================================
ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointments_business_isolation ON "Appointment";
CREATE POLICY appointments_business_isolation ON "Appointment"
  FOR ALL
  USING (
    "businessId" = get_current_business_id()::TEXT
    OR get_current_business_id() IS NULL
  );

-- ============================================
-- 7. RLS ДЛЯ masters
-- ============================================
ALTER TABLE "Master" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS masters_business_isolation ON "Master";
CREATE POLICY masters_business_isolation ON "Master"
  FOR ALL
  USING (
    "businessId" = get_current_business_id()::TEXT
    OR get_current_business_id() IS NULL
  );

-- ============================================
-- 8. RLS ДЛЯ services
-- ============================================
ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS services_business_isolation ON "Service";
CREATE POLICY services_business_isolation ON "Service"
  FOR ALL
  USING (
    "businessId" = get_current_business_id()::TEXT
    OR get_current_business_id() IS NULL
  );

-- ============================================
-- 9. ТРИГЕРНА ФУНКЦІЯ ДЛЯ ДУБЛЮВАННЯ clients
-- ============================================
CREATE OR REPLACE FUNCTION sync_to_admin_control_center()
RETURNS TRIGGER AS $trigger$
DECLARE
  business_record RECORD;
BEGIN
  SELECT id, phone, email, name
  INTO business_record
  FROM "Business"
  WHERE id = NEW."businessId";

        INSERT INTO admin_control_center (
          business_id, business_phone, business_email, business_name,
          client_id, client_name, client_phone, action_type, metadata, created_at
        ) VALUES (
          business_record.id::TEXT,
          business_record.phone,
          business_record.email,
          business_record.name,
          NEW.id::TEXT,
          NEW.name,
          NEW.phone,
          'client_created',
          jsonb_build_object(
            'client_id', NEW.id,
            'business_id', NEW."businessId",
            'created_at', NEW."createdAt"
          ),
          NOW()
        );

  RETURN NEW;
END;
$trigger$ LANGUAGE plpgsql;

-- ============================================
-- 10. ТРИГЕР ПІСЛЯ INSERT НА clients
-- ============================================
DROP TRIGGER IF EXISTS trigger_sync_client_to_admin_control ON "Client";
CREATE TRIGGER trigger_sync_client_to_admin_control
  AFTER INSERT ON "Client"
  FOR EACH ROW
  EXECUTE FUNCTION sync_to_admin_control_center();

-- ============================================
-- 11. ТРИГЕР ДЛЯ appointments
-- ============================================
CREATE OR REPLACE FUNCTION sync_appointment_to_admin_control()
RETURNS TRIGGER AS $trigger$
DECLARE
  business_record RECORD;
  client_record RECORD;
BEGIN
  SELECT id, phone, email, name
  INTO business_record
  FROM "Business"
  WHERE id = NEW."businessId";

  IF NEW."clientId" IS NOT NULL THEN
    SELECT id, name, phone
    INTO client_record
    FROM "Client"
    WHERE id = NEW."clientId";
  END IF;

        INSERT INTO admin_control_center (
          business_id, business_phone, business_email, business_name,
          client_id, client_name, client_phone, action_type, metadata, created_at
        ) VALUES (
          business_record.id::TEXT,
          business_record.phone,
          business_record.email,
          business_record.name,
          COALESCE(client_record.id::TEXT, NULL),
          COALESCE(client_record.name, NEW."clientName"),
          COALESCE(client_record.phone, NEW."clientPhone"),
          'appointment_created',
          jsonb_build_object(
            'appointment_id', NEW.id,
            'business_id', NEW."businessId",
            'master_id', NEW."masterId",
            'start_time', NEW."startTime",
            'status', NEW.status,
            'created_at', NEW."createdAt"
          ),
          NOW()
        );

  RETURN NEW;
END;
$trigger$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_appointment_to_admin_control ON "Appointment";
CREATE TRIGGER trigger_sync_appointment_to_admin_control
  AFTER INSERT ON "Appointment"
  FOR EACH ROW
  EXECUTE FUNCTION sync_appointment_to_admin_control();

-- ============================================
-- 12. ТРИГЕР ДЛЯ businesses
-- ============================================
CREATE OR REPLACE FUNCTION sync_business_to_admin_control()
RETURNS TRIGGER AS $trigger$
BEGIN
        INSERT INTO admin_control_center (
          business_id, business_phone, business_email, business_name,
          action_type, metadata, created_at
        ) VALUES (
          NEW.id::TEXT,
          NEW.phone,
          NEW.email,
          NEW.name,
          'business_created',
          jsonb_build_object(
            'business_id', NEW.id,
            'slug', NEW.slug,
            'niche', NEW.niche,
            'created_at', NEW."createdAt"
          ),
          NOW()
        );

  RETURN NEW;
END;
$trigger$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_business_to_admin_control ON "Business";
CREATE TRIGGER trigger_sync_business_to_admin_control
  AFTER INSERT ON "Business"
  FOR EACH ROW
  EXECUTE FUNCTION sync_business_to_admin_control();

-- ============================================
-- 13. GRANT ПРАВ ДОСТУПУ
-- ============================================
GRANT EXECUTE ON FUNCTION set_current_business_id(UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_current_business_id() TO PUBLIC;

