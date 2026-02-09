-- Composite indexes for faster queries (scaling optimization)
CREATE INDEX IF NOT EXISTS "Client_businessId_status_idx" ON "Client"("businessId", "status");
CREATE INDEX IF NOT EXISTS "Appointment_businessId_startTime_idx" ON "Appointment"("businessId", "startTime");
CREATE INDEX IF NOT EXISTS "Appointment_businessId_status_idx" ON "Appointment"("businessId", "status");
