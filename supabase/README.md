# Supabase backend

Project ref: `slwzjufipavuwcbwoyro`  
Region: `ap-northeast-1`  
Dashboard: https://supabase.com/dashboard/project/slwzjufipavuwcbwoyro

Backend modules currently provisioned: PostgreSQL tables and RLS, private Object Storage bucket `user-files`, initial Realtime publication, and an authenticated direct-conversation RPC. The bucket limit is exactly 50,000,000 bytes; MIME/extension filtering is not configured.

See `migrations/README.md` for live migration ledger and important source-sync caveats. Never place service-role keys in Android.
