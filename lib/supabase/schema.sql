-- =============================================
-- SCOTTLAND FANTASY LEAGUE - SUPABASE SCHEMA
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PROFILES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  fantasy_points INTEGER DEFAULT 0,
  phone TEXT,
  favorite_player TEXT,
  supporter_branch TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- =============================================
-- PLAYERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('GK', 'DEF', 'MID', 'FWD')),
  club TEXT NOT NULL DEFAULT 'Scottland FC',
  price INTEGER NOT NULL DEFAULT 5000000,
  image_url TEXT,
  total_points INTEGER DEFAULT 0,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  clean_sheets INTEGER DEFAULT 0,
  yellow_cards INTEGER DEFAULT 0,
  red_cards INTEGER DEFAULT 0,
  minutes_played INTEGER DEFAULT 0,
  ownership_percent DECIMAL(5,2) DEFAULT 0,
  form DECIMAL(4,2) DEFAULT 5.0,
  is_injured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players are viewable by everyone" ON players FOR SELECT USING (true);
CREATE POLICY "Only admins can manage players" ON players FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND level >= 10)
);

-- =============================================
-- FANTASY TEAMS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS fantasy_teams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  team_name TEXT NOT NULL,
  formation TEXT DEFAULT '4-3-3' CHECK (formation IN ('4-3-3', '4-4-2', '3-5-2', '5-3-2')),
  total_points INTEGER DEFAULT 0,
  weekly_points INTEGER DEFAULT 0,
  budget_remaining INTEGER DEFAULT 100000000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE fantasy_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fantasy teams viewable by everyone" ON fantasy_teams FOR SELECT USING (true);
CREATE POLICY "Users manage own team" ON fantasy_teams FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- FANTASY TEAM PLAYERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS fantasy_team_players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fantasy_team_id UUID REFERENCES fantasy_teams(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  is_captain BOOLEAN DEFAULT FALSE,
  is_vice_captain BOOLEAN DEFAULT FALSE,
  is_starting BOOLEAN DEFAULT TRUE,
  bench_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fantasy_team_id, player_id)
);

ALTER TABLE fantasy_team_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team players viewable by everyone" ON fantasy_team_players FOR SELECT USING (true);
CREATE POLICY "Users manage own team players" ON fantasy_team_players FOR ALL USING (
  EXISTS (SELECT 1 FROM fantasy_teams WHERE id = fantasy_team_id AND user_id = auth.uid())
);

-- =============================================
-- LEAGUES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS leagues (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'private' CHECK (type IN ('public', 'private')),
  invite_code TEXT UNIQUE,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  description TEXT,
  max_members INTEGER DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public leagues viewable by everyone" ON leagues FOR SELECT USING (type = 'public' OR owner_id = auth.uid());
CREATE POLICY "Authenticated users create leagues" ON leagues FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update leagues" ON leagues FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete leagues" ON leagues FOR DELETE USING (auth.uid() = owner_id);

-- =============================================
-- LEAGUE MEMBERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS league_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  points INTEGER DEFAULT 0,
  weekly_points INTEGER DEFAULT 0,
  rank INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, user_id)
);

ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "League members viewable by members" ON league_members FOR SELECT USING (true);
CREATE POLICY "Users join leagues" ON league_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users leave leagues" ON league_members FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- MATCHES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS matches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  kickoff_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'finished', 'postponed')),
  matchday INTEGER DEFAULT 1,
  season TEXT DEFAULT '2025/26',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches viewable by everyone" ON matches FOR SELECT USING (true);

-- =============================================
-- PLAYER MATCH STATS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS player_match_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  yellow_cards INTEGER DEFAULT 0,
  red_cards INTEGER DEFAULT 0,
  clean_sheet BOOLEAN DEFAULT FALSE,
  minutes_played INTEGER DEFAULT 0,
  fantasy_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, match_id)
);

ALTER TABLE player_match_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stats viewable by everyone" ON player_match_stats FOR SELECT USING (true);

-- =============================================
-- CHAT MESSAGES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(message) <= 500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat messages viewable by everyone" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Authenticated users send messages" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own messages" ON chat_messages FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT DEFAULT 'system' CHECK (type IN ('match', 'transfer', 'goal', 'league', 'reward', 'system')),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- ACHIEVEMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS achievements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  badge_key TEXT NOT NULL,
  badge_name TEXT NOT NULL,
  badge_description TEXT NOT NULL,
  badge_icon TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_key)
);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Achievements viewable by everyone" ON achievements FOR SELECT USING (true);

-- =============================================
-- POLLS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS polls (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  votes JSONB NOT NULL DEFAULT '{}',
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Polls viewable by everyone" ON polls FOR SELECT USING (true);
CREATE POLICY "Authenticated users vote" ON polls FOR UPDATE USING (auth.uid() IS NOT NULL);

-- =============================================
-- REALTIME SUBSCRIPTIONS
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE player_match_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE fantasy_teams;

-- =============================================
-- SEED DATA - SCOTTLAND FC PLAYERS
-- =============================================
INSERT INTO players (name, position, club, price, total_points, goals, assists, clean_sheets, form) VALUES
  ('Tatenda Mukuruva', 'GK', 'Scottland FC', 5500000, 89, 0, 0, 8, 7.2),
  ('Raphael Manuvire', 'GK', 'Scottland FC', 4500000, 71, 0, 0, 6, 6.1),
  ('Blessing Moyo', 'DEF', 'Scottland FC', 6000000, 95, 2, 4, 7, 7.8),
  ('Gerald Takwara', 'DEF', 'Scottland FC', 5500000, 82, 1, 3, 6, 7.0),
  ('Kudzai Dhemba', 'DEF', 'Scottland FC', 5000000, 74, 0, 2, 5, 6.5),
  ('Tawanda Chimwemwe', 'DEF', 'Scottland FC', 5000000, 68, 1, 1, 5, 6.2),
  ('Shingirai Musendo', 'MID', 'Scottland FC', 8500000, 132, 7, 11, 2, 9.1),
  ('Farai Madhananga', 'MID', 'Scottland FC', 7500000, 118, 5, 9, 1, 8.6),
  ('Wellington Taderera', 'MID', 'Scottland FC', 7000000, 105, 4, 8, 0, 8.2),
  ('Elton Mukoyi', 'MID', 'Scottland FC', 6500000, 98, 3, 6, 1, 7.9),
  ('Knox Mutizwa', 'MID', 'Scottland FC', 6000000, 87, 2, 7, 0, 7.5),
  ('Khama Billiat', 'FWD', 'Scottland FC', 12000000, 178, 18, 9, 0, 9.8),
  ('Leonard Sengwe', 'FWD', 'Scottland FC', 10500000, 155, 14, 7, 0, 9.3),
  ('Tino Kadewere', 'FWD', 'Scottland FC', 10000000, 148, 13, 8, 0, 9.1),
  ('Prince Dube', 'FWD', 'Scottland FC', 9000000, 131, 11, 5, 0, 8.7),
  ('Denver Mukamba', 'FWD', 'Scottland FC', 8000000, 112, 9, 6, 0, 8.2),
  ('Ovidy Karuru', 'MID', 'Scottland FC', 9500000, 141, 8, 13, 0, 8.9),
  ('Knowledge Musona', 'FWD', 'Scottland FC', 11000000, 162, 15, 8, 0, 9.4)
ON CONFLICT DO NOTHING;

-- Seed matches
INSERT INTO matches (home_team, away_team, kickoff_time, status, matchday, season) VALUES
  ('Scottland FC', 'Dynamos FC', NOW() + INTERVAL '2 days', 'scheduled', 12, '2025/26'),
  ('CAPS United', 'Scottland FC', NOW() + INTERVAL '7 days', 'scheduled', 13, '2025/26'),
  ('Scottland FC', 'Highlanders FC', NOW() - INTERVAL '7 days', 'finished', 11, '2025/26'),
  ('Chicken Inn', 'Scottland FC', NOW() - INTERVAL '14 days', 'finished', 10, '2025/26')
ON CONFLICT DO NOTHING;

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update updated_at on profile changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER fantasy_teams_updated_at
  BEFORE UPDATE ON fantasy_teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
