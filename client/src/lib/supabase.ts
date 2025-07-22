import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://sdrpmyamxcfogbarnasu.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkcnBteWFteGNmb2diYXJuYXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3NjgyNjIsImV4cCI6MjA2ODM0NDI2Mn0.g3TYumG8d9y1AfU28Ffi8apZkTd2apttgY_B7zb-xVs"
);