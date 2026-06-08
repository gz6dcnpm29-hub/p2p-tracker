-- ============================================================
-- P2P TRACKER — SUPABASE SQL SETUP
-- Выполни этот скрипт в Supabase → SQL Editor
-- ============================================================

-- 1. Таблица профилей (расширение auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'worker' CHECK (role IN ('admin', 'worker')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Автоматически создавать профиль при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'worker')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Таблица ордеров
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  worker_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
  rate NUMERIC(10, 4) NOT NULL,
  volume_uah NUMERIC(14, 2) NOT NULL,
  volume_usdt NUMERIC(14, 4) NOT NULL,
  platform TEXT DEFAULT 'Binance',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Таблица пар (спред)
CREATE TABLE IF NOT EXISTS public.pairs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buy_order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  sell_order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  buy_rate NUMERIC(10, 4) NOT NULL,
  sell_rate NUMERIC(10, 4) NOT NULL,
  spread_pct NUMERIC(8, 4),
  profit_uah NUMERIC(14, 2),
  workers TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pairs ENABLE ROW LEVEL SECURITY;

-- Профили: каждый видит себя, admin видит всех
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- Ордера: worker видит только свои, admin — все
CREATE POLICY "orders_select_worker" ON public.orders FOR SELECT
  USING (
    worker_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "orders_insert" ON public.orders FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "orders_delete_admin" ON public.orders FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Пары: все авторизованные видят, admin создаёт
CREATE POLICY "pairs_select" ON public.pairs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "pairs_insert_admin" ON public.pairs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "pairs_delete_admin" ON public.pairs FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- ============================================================
-- СОЗДАЙ ПЕРВОГО ADMIN-ПОЛЬЗОВАТЕЛЯ:
-- 1. Зарегистрируйся через приложение
-- 2. Выполни этот запрос, подставив свой email:
-- ============================================================
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
