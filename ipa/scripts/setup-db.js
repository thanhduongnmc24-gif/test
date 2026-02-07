// File: scripts/setup-db.js
const { Client } = require('pg');

// Chuỗi kết nối Pooler của anh
const connectionString = 'postgresql://postgres.ykwdxgjzmiduayedykhv:Nguyenthanhduong1511@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

const createSheetTableQuery = `
  -- 1. TẠO BẢNG CẤU HÌNH SHEETS
  CREATE TABLE IF NOT EXISTS public.sheet_configs (
    user_id uuid PRIMARY KEY DEFAULT auth.uid(), -- Mỗi user chỉ có 1 dòng cấu hình duy nhất
    webhook_url text,
    sheet_link text,
    text_data jsonb DEFAULT '[]'::jsonb,   -- Lưu mảng các ô text
    image_data jsonb DEFAULT '[]'::jsonb,  -- Lưu mảng các ô ảnh (chỉ lưu vị trí, ko lưu ảnh)
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
  );

  -- 2. BẬT BẢO MẬT (RLS)
  ALTER TABLE public.sheet_configs ENABLE ROW LEVEL SECURITY;

  -- 3. TẠO POLICY (Ai quản lý cấu hình người nấy)
  DROP POLICY IF EXISTS "User can manage their own sheet config" ON public.sheet_configs;
  CREATE POLICY "User can manage their own sheet config" ON public.sheet_configs
    FOR ALL USING (auth.uid() = user_id);
`;

async function setupSheetDB() {
  try {
    console.log("⏳ Đang kết nối tới Supabase...");
    await client.connect();
    
    console.log("🚀 Đang tạo bảng sheet_configs...");
    await client.query(createSheetTableQuery);
    
    console.log("✅ Xong phim! Bảng cấu hình Sheet đã sẵn sàng.");
  } catch (err) {
    console.error("❌ Lỗi:", err);
  } finally {
    await client.end();
  }
}

setupSheetDB();