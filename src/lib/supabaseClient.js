import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rkfvqjfyjngvjytbawyk.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZnZxamZ5am5ndmp5dGJhd3lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjI3NTcsImV4cCI6MjA5NzI5ODc1N30.piGWxRmeYn3x3RgelxJ5AGPt_8kKCGoen9l0Zn1QAE8";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
