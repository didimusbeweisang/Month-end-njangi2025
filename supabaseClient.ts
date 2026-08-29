import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cgyisvdjnvfbkuidtigh.supabase.co'
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneWlzdmRqbnZmYmt1aWR0aWdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzcxNTMsImV4cCI6MjA5NjI1MzE1M30.qu2tUJr2o_RpAtv6INdt0jH0bdvOCZBSngjaVHLJAaA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
