// File: scripts/setup-db.js
const { Client } = require('pg');

// 👇 DÁN CHUỖI MỚI (CÓ CHỮ .pooler.supabase.com) VÀO ĐÂY
// Nhớ điền mật khẩu của anh vào chỗ [YOUR-PASSWORD] nhé
const connectionString = 'postgresql://postgres.ykwdxgjzmiduayedykhv:Nguyenthanhduong1511@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

// ⚠️ Nếu anh không tìm thấy link Pooler, thử đổi "db.ykw..." thành "aws-0-ap-southeast-1.pooler.supabase.com"
// và port 5432 thành 6543 xem sao (Tèo đoán server anh ở Sing - ap-southeast-1).

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false } // Quan trọng khi chạy từ local/codespace
});

const createTablesQuery = `
  CREATE TABLE IF NOT EXISTS public.notes (
    id text PRIMARY KEY,
    title text,
    content text,
    date text,
    is_pinned boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    user_id uuid DEFAULT auth.uid()
  );

  CREATE TABLE IF NOT EXISTS public.reminders (
    id text PRIMARY KEY,
    title text,
    content text,
    date_time text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    user_id uuid DEFAULT auth.uid()
  );

  ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "User can manage their own notes" ON public.notes;
  CREATE POLICY "User can manage their own notes" ON public.notes
    FOR ALL USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "User can manage their own reminders" ON public.reminders;
  CREATE POLICY "User can manage their own reminders" ON public.reminders
    FOR ALL USING (auth.uid() = user_id);
`;

async function setupDatabase() {
  try {
    console.log("⏳ Đang kết nối tới Supabase (qua Pooler)...");
    await client.connect();
    console.log("🚀 Đang khởi tạo bảng...");
    await client.query(createTablesQuery);
    console.log("✅ Ngon lành cành đào! Bảng đã được tạo.");
  } catch (err) {
    console.error("❌ Lỗi:", err);
  } finally {
    await client.end();
  }
}

setupDatabase();