# Supabase Setup Guide for ZeroVault

This guide walks you through setting up Supabase for the ZeroVault password manager.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up
2. Create a new project with:
   - Organization: Your choice
   - Project name: `zerovault` (or your preference)
   - Database password: Generate a strong password
   - Region: Choose closest to you
3. Wait for the project to be created (2-3 minutes)

## 2. Get Your Credentials

From your Supabase project dashboard:
1. Go to **Settings** → **API**
2. Copy:
   - **Project URL**: This is your `VITE_SUPABASE_URL`
   - **Anon Public Key**: This is your `VITE_SUPABASE_ANON_KEY`
3. Save these in a `.env.local` file in the root of your project (see `.env.example`)

## 3. Create Database Tables

Go to **SQL Editor** in your Supabase dashboard and run the following SQL script:

### Create Users Table (Extended Auth)
```sql
-- This extends the Supabase auth.users table with additional metadata
create table if not exists public.user_metadata (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  master_password_hash text not null,
  vault_salt text not null,
  device_count integer default 1,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.user_metadata enable row level security;

-- Create policy so users can only see their own metadata
create policy "Users can view their own metadata"
  on public.user_metadata for select
  using (auth.uid() = id);

create policy "Users can update their own metadata"
  on public.user_metadata for update
  using (auth.uid() = id);
```

### Create Credentials Table
```sql
create table if not exists public.credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  
  -- Credential metadata (in plaintext - just domain/service name)
  name text not null,
  url text not null,
  
  -- Encrypted data (sent encrypted from client, stored encrypted)
  encrypted_data text not null,
  iv text, -- Initialization vector for encryption
  
  -- Sync metadata
  version integer default 1,
  lastUpdated bigint default extract(epoch from now()) * 1000,
  deleted_at timestamp with time zone, -- Soft delete for sync
  
  -- Device tracking
  device_id uuid, -- Which device last modified this
  
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  unique(user_id, id)
);

-- Create indexes for performance
create index idx_credentials_user_id on public.credentials(user_id);
create index idx_credentials_user_lastUpdated on public.credentials(user_id, lastUpdated);

-- Enable RLS
alter table public.credentials enable row level security;

-- Create policies - users can only see and modify their own credentials
create policy "Users can view their own credentials"
  on public.credentials for select
  using (auth.uid() = user_id);

create policy "Users can create credentials"
  on public.credentials for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own credentials"
  on public.credentials for update
  using (auth.uid() = user_id);

create policy "Users can delete their own credentials"
  on public.credentials for delete
  using (auth.uid() = user_id);
```

### Create Devices Table
```sql
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  
  name text not null,
  type text not null, -- 'extension' | 'mobile' | 'desktop'
  user_agent text,
  
  last_seen timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  
  unique(user_id, id)
);

-- Create indexes
create index idx_devices_user_id on public.devices(user_id);
create index idx_devices_last_seen on public.devices(user_id, last_seen);

-- Enable RLS
alter table public.devices enable row level security;

-- Create policies
create policy "Users can view their own devices"
  on public.devices for select
  using (auth.uid() = user_id);

create policy "Users can create devices"
  on public.devices for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own devices"
  on public.devices for update
  using (auth.uid() = user_id);

create policy "Users can delete their own devices"
  on public.devices for delete
  using (auth.uid() = user_id);
```

### Create Sync History Table (for audit trail)
```sql
create table if not exists public.sync_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  
  sync_type text not null, -- 'push' | 'pull' | 'bidirectional'
  credentials_synced integer default 0,
  
  created_at timestamp with time zone default now()
);

-- Create index
create index idx_sync_history_user_id on public.sync_history(user_id);
create index idx_sync_history_created_at on public.sync_history(user_id, created_at);

-- Enable RLS
alter table public.sync_history enable row level security;

-- Create policy
create policy "Users can view their own sync history"
  on public.sync_history for select
  using (auth.uid() = user_id);
```

## 4. Configure Authentication Settings

1. In Supabase, go to **Authentication** → **Providers**
2. Enable **Email** provider (should be enabled by default)
3. Go to **Authentication** → **Email Templates** and configure if desired
4. (Optional) Add other providers like Google, GitHub, etc.

## 5. Set Up Row Level Security (RLS)

RLS is already configured in the SQL above. Verify in your Supabase dashboard:
1. Go to **Authentication** → **Policies**
2. You should see policies for each table
3. These ensure users can only access their own data

## 6. Configure Environment Variables

Copy your Supabase credentials to `.env.local`:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 7. Test the Connection

The extension will automatically test the connection when you:
1. Log in / Register
2. Try to sync credentials

Check the browser console for any errors.

## Important Security Notes

1. **Client-Side Encryption**: All passwords and sensitive data are encrypted on the client before being sent to Supabase
2. **Zero Knowledge**: The server only stores encrypted data and metadata
3. **RLS**: Row Level Security ensures users can only access their own data
4. **Password Hash**: Master password hash is stored separately from credentials
5. **Never Share Keys**: Never share your `VITE_SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_ROLE_KEY`

## Troubleshooting

### Connection Errors
- Check your `.env.local` file has correct URL and key
- Verify your Supabase project is active
- Check browser console for specific error messages

### Auth Errors
- Clear extension storage and try again
- Verify email is correctly registered
- Check email for confirmation link if needed

### Sync Errors
- Ensure credentials table exists
- Check Row Level Security policies
- Review Supabase logs for detailed errors

## Next Steps

After setting up Supabase:
1. Update auth flow in `src/pages/auth/Login.tsx` to use Supabase
2. Update sync service to push/pull encrypted credentials
3. Implement conflict resolution for multi-device sync
4. Add device registration on first login

See the Phase 3 implementation guide for details.
