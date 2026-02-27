-- Create vaults table for encrypted vault storage
CREATE TABLE IF NOT EXISTS vaults (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    encrypted_data TEXT NOT NULL,
    version BIGINT NOT NULL DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one vault per user
    UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX idx_vaults_user_id ON vaults(user_id);

-- Create index for version tracking
CREATE INDEX idx_vaults_version ON vaults(user_id, version);

-- RLS (Row Level Security) Policy
-- Only users can access their own vault
ALTER TABLE vaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vault" ON vaults
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vault" ON vaults
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vault" ON vaults
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own vault" ON vaults
    FOR DELETE USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_vaults_updated_at
    BEFORE UPDATE ON vaults
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
