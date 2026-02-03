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
-- Використовується для RLS (Row Level Security)
CREATE OR REPLACE FUNCTION set_current_business_id(business_uuid UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_business_id', business_uuid::TEXT, false);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. ФУНКЦІЯ ДЛЯ ОТРИМАННЯ поточного business_id
-- ============================================
CREATE OR REPLACE FUNCTION get_current_business_id()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_business_id', true), '')::UUID;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. ОНОВЛЕННЯ ТАБЛИЦІ businesses (якщо потрібно)
-- ============================================
-- Переконаємося, що id має тип UUID
-- (якщо використовується CUID, потрібно буде конвертувати)

-- ============================================
-- 5. ROW LEVEL SECURITY ДЛЯ clients
-- ============================================

-- Увімкнути RLS для таблиці clients
ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;

-- Політика: бізнес бачить тільки своїх клієнтів
CREATE POLICY clients_business_isolation ON "Client"
  FOR ALL
  USING (
    "businessId" = get_current_business_id()::TEXT
    OR get_current_business_id() IS NULL -- Дозволяємо системним запитам
  );

-- Політика для INSERT: можна створювати тільки для свого бізнесу
CREATE POLICY clients_insert_isolation ON "Client"
  FOR INSERT
  WITH CHECK (
    "businessId" = get_current_business_id()::TEXT
    OR get_current_business_id() IS NULL
  );

-- Політика для UPDATE: можна оновлювати тільки своїх клієнтів
CREATE POLICY clients_update_isolation ON "Client"
  FOR UPDATE
  USING (
    "businessId" = get_current_business_id()::TEXT
    OR get_current_business_id() IS NULL
  );

-- Політика для DELETE: можна видаляти тільки своїх клієнтів
CREATE POLICY clients_delete_isolation ON "Client"
  FOR DELETE
  USING (
    "businessId" = get_current_business_id()::TEXT
    OR get_current_business_id() IS NULL
  );

-- ============================================
-- 6. RLS ДЛЯ appointments
-- ============================================
ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY services_business_isolation ON "Service"
  FOR ALL
  USING (
    "businessId" = get_current_business_id()::TEXT
    OR get_current_business_id() IS NULL
  );

-- ============================================
-- 9. ADMIN CONTROL CENTER (Архів)
-- ============================================
-- Таблиця для зберігання архівних даних
-- Дані зберігаються навіть після видалення бізнесу
CREATE TABLE IF NOT EXISTS admin_control_center (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL, -- Зберігаємо навіть після видалення бізнесу
  business_phone TEXT,
  business_email TEXT,
  business_name TEXT,
  client_id UUID,
  client_name TEXT,
  client_phone TEXT,
  action_type TEXT NOT NULL DEFAULT 'client_created', -- 'client_created', 'business_created', 'appointment_created'
  metadata JSONB, -- Додаткові дані
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Індекси для швидкого пошуку
CREATE INDEX idx_admin_control_business_id ON admin_control_center(business_id);
CREATE INDEX idx_admin_control_client_phone ON admin_control_center(client_phone);
CREATE INDEX idx_admin_control_business_phone ON admin_control_center(business_phone);
CREATE INDEX idx_admin_control_created_at ON admin_control_center(created_at);
CREATE INDEX idx_admin_control_action_type ON admin_control_center(action_type);

-- ============================================
-- 10. ТРИГЕРНА ФУНКЦІЯ ДЛЯ ДУБЛЮВАННЯ В admin_control_center
-- ============================================
CREATE OR REPLACE FUNCTION sync_to_admin_control_center()
RETURNS TRIGGER AS $$
DECLARE
  business_record RECORD;
BEGIN
  -- Отримуємо дані бізнесу
  SELECT 
    id,
    phone,
    email,
    name
  INTO business_record
  FROM "Business"
  WHERE id = NEW."businessId";

  -- Вставляємо запис в admin_control_center
  INSERT INTO admin_control_center (
    business_id,
    business_phone,
    business_email,
    business_name,
    client_id,
    client_name,
    client_phone,
    action_type,
    metadata,
    created_at
  ) VALUES (
    business_record.id::UUID,
    business_record.phone,
    business_record.email,
    business_record.name,
    NEW.id::UUID,
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
$$ LANGUAGE plpgsql;

-- ============================================
-- 11. ТРИГЕР ПІСЛЯ INSERT НА clients
-- ============================================
DROP TRIGGER IF EXISTS trigger_sync_client_to_admin_control ON "Client";

CREATE TRIGGER trigger_sync_client_to_admin_control
  AFTER INSERT ON "Client"
  FOR EACH ROW
  EXECUTE FUNCTION sync_to_admin_control_center();

-- ============================================
-- 12. ТРИГЕР ДЛЯ appointments (опціонально)
-- ============================================
CREATE OR REPLACE FUNCTION sync_appointment_to_admin_control()
RETURNS TRIGGER AS $$
DECLARE
  business_record RECORD;
  client_record RECORD;
BEGIN
  -- Отримуємо дані бізнесу
  SELECT 
    id,
    phone,
    email,
    name
  INTO business_record
  FROM "Business"
  WHERE id = NEW."businessId";

  -- Отримуємо дані клієнта (якщо є clientId)
  IF NEW."clientId" IS NOT NULL THEN
    SELECT 
      id,
      name,
      phone
    INTO client_record
    FROM "Client"
    WHERE id = NEW."clientId";
  END IF;

  -- Вставляємо запис в admin_control_center
  INSERT INTO admin_control_center (
    business_id,
    business_phone,
    business_email,
    business_name,
    client_id,
    client_name,
    client_phone,
    action_type,
    metadata,
    created_at
  ) VALUES (
    business_record.id::UUID,
    business_record.phone,
    business_record.email,
    business_record.name,
    COALESCE(client_record.id::UUID, NULL),
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_appointment_to_admin_control ON "Appointment";

CREATE TRIGGER trigger_sync_appointment_to_admin_control
  AFTER INSERT ON "Appointment"
  FOR EACH ROW
  EXECUTE FUNCTION sync_appointment_to_admin_control();

-- ============================================
-- 13. ТРИГЕР ДЛЯ businesses (при створенні)
-- ============================================
CREATE OR REPLACE FUNCTION sync_business_to_admin_control()
RETURNS TRIGGER AS $$
BEGIN
  -- Вставляємо запис в admin_control_center при створенні бізнесу
  INSERT INTO admin_control_center (
    business_id,
    business_phone,
    business_email,
    business_name,
    action_type,
    metadata,
    created_at
  ) VALUES (
    NEW.id::UUID,
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_business_to_admin_control ON "Business";

CREATE TRIGGER trigger_sync_business_to_admin_control
  AFTER INSERT ON "Business"
  FOR EACH ROW
  EXECUTE FUNCTION sync_business_to_admin_control();

-- ============================================
-- 14. КОМЕНТАРІ ДЛЯ ДОКУМЕНТАЦІЇ
-- ============================================
COMMENT ON TABLE admin_control_center IS 'Архівна таблиця для зберігання даних бізнесів та клієнтів. Дані зберігаються навіть після видалення бізнесу.';
COMMENT ON FUNCTION set_current_business_id IS 'Встановлює поточний business_id в сесійній змінній для RLS';
COMMENT ON FUNCTION get_current_business_id IS 'Отримує поточний business_id з сесійної змінної для RLS';
COMMENT ON FUNCTION sync_to_admin_control_center IS 'Тригерна функція для дублювання даних клієнтів в admin_control_center';
COMMENT ON FUNCTION sync_appointment_to_admin_control IS 'Тригерна функція для дублювання даних записів в admin_control_center';
COMMENT ON FUNCTION sync_business_to_admin_control IS 'Тригерна функція для дублювання даних бізнесів в admin_control_center';

-- ============================================
-- 15. GRANT ПРАВ ДОСТУПУ
-- ============================================
-- Надаємо права на використання функцій
GRANT EXECUTE ON FUNCTION set_current_business_id(UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_current_business_id() TO PUBLIC;

-- ============================================
-- ГОТОВО!
-- ============================================
-- Тепер система має:
-- 1. Row Level Security (RLS) для ізоляції даних
-- 2. Тригерне дублювання в admin_control_center
-- 3. Архівні дані, які зберігаються навіть після видалення

