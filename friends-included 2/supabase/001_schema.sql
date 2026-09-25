-- Run once in a new Supabase project's SQL Editor. No sample transactions are inserted.
begin;
create table public.fi_employees (
 id text primary key, name text not null, role text not null check (role in ('manager','salesperson','reporter'))
);
insert into public.fi_employees values
 ('svetlana','Svetlana de Monte Carlo','manager'),('richard','Richard “Call Me Dick” Darling','salesperson'),
 ('anastasia','Anastasia Ferrari','salesperson'),('jean-claude','Jean-Claude Bērziņš','salesperson'),('kevin','Kevin von Whatever','reporter');
create table public.fi_links (
 user_id text primary key check (user_id ~ '^[0-9]+$'), chat_id text not null check (chat_id ~ '^[0-9]+$'),
 employee text not null unique references public.fi_employees(id), updated_at timestamptz not null default now()
);
create table public.fi_transactions (
 reference text primary key check (reference ~ '^[A-Z0-9][A-Z0-9_-]{0,29}$'),
 row_number bigint generated always as identity (start with 2) unique,
 data jsonb not null,
 version integer not null default 1,
 sync_status text not null default 'Sync pending', sync_error text, sync_attempted_at timestamptz,
 check ((data->>'reference') = reference),
 check ((data->>'amount_cents')::bigint > 0),
 check ((data->>'kind') in ('sale','expense')),
 check ((data->>'version')::integer = version)
);
create table public.fi_notifications (
 id bigint generated always as identity primary key,
 reference text not null references public.fi_transactions(reference),
 event text not null check (event in ('submission','decision')),
 chat_id text, message text not null,
 status text not null default 'Pending', error text, sent_at timestamptz, attempted_at timestamptz,
 unique(reference,event)
);
create table public.fi_worker_lock (id integer primary key check (id=1), token text, expires_at timestamptz);
insert into public.fi_worker_lock(id) values(1);

-- Service-role-only RPCs. The HTTP processing layer validates content and computes
-- integer-cent commissions. This layer adds atomicity, role checks and race protection.
create function public.fi_save(p_actor text,p_data jsonb,p_expected integer,p_message text,p_chat text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare old public.fi_transactions; result public.fi_transactions; actor_role text; event_name text;
begin
 select role into actor_role from public.fi_employees where id=p_actor;
 if p_expected=0 then
   if actor_role is distinct from (case when p_data->>'kind'='sale' then 'salesperson' else 'reporter' end)
     or p_data->>'employee' is distinct from p_actor then raise exception 'Permission denied'; end if;
   if (p_data->>'version')::integer <> 1 then raise exception 'Invalid version'; end if;
   insert into public.fi_transactions(reference,data) values(p_data->>'reference',p_data) returning * into result;
   event_name := 'submission';
 else
   if actor_role is distinct from 'manager' then raise exception 'Permission denied'; end if;
   select * into old from public.fi_transactions where reference=p_data->>'reference' for update;
   if not found then raise exception 'Transaction not found'; end if;
   if old.data->>'status' not in ('Pending approval','Awaiting allocation') then return to_jsonb(old); end if;
   if old.version<>p_expected then raise exception 'Transaction changed; refresh and retry'; end if;
   if (p_data - array['version','approved_at','approved_by','status','approved_split','earned','pool','final_allocation'])
      is distinct from (old.data - array['version','approved_at','approved_by','status','approved_split','earned','pool','final_allocation'])
      then raise exception 'Original submission cannot be changed'; end if;
   if p_data->>'status'<>'Approved' or p_data->>'approved_by'<>p_actor then raise exception 'Invalid decision'; end if;
   update public.fi_transactions set data=p_data,version=version+1,sync_status='Sync pending',sync_error=null
    where reference=old.reference returning * into result;
   event_name := 'decision';
 end if;
 insert into public.fi_notifications(reference,event,chat_id,message,status)
 values(result.reference,event_name,p_chat,p_message,case when p_chat is null then 'No Telegram recipient linked' else 'Pending' end);
 return to_jsonb(result);
end $$;

create function public.fi_link(p_actor text,p_user text,p_employee text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.fi_employees where id=p_actor and role='manager') then raise exception 'Permission denied'; end if;
 -- A private Telegram chat ID is the user's ID. Only private chats are accepted by the bot.
 perform pg_advisory_xact_lock(734920);
 delete from public.fi_links where user_id=p_user or employee=p_employee;
 insert into public.fi_links(user_id,chat_id,employee) values(p_user,p_user,p_employee);
end $$;

create function public.fi_lock(p_token text) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.fi_worker_lock set token=p_token,expires_at=now()+interval '90 seconds'
 where id=1 and (expires_at is null or expires_at<now());
 return found;
end $$;
create function public.fi_unlock(p_token text) returns void language sql security invoker set search_path='' as $$
 update public.fi_worker_lock set token=null,expires_at=null where id=1 and token=p_token;
$$;
create function public.fi_sync_done(p_ref text,p_version integer,p_status text,p_error text)
returns void language sql security invoker set search_path='' as $$
 update public.fi_transactions set sync_status=p_status,sync_error=p_error,sync_attempted_at=now() where reference=p_ref and version=p_version;
$$;

alter table public.fi_employees enable row level security;
alter table public.fi_links enable row level security;
alter table public.fi_transactions enable row level security;
alter table public.fi_notifications enable row level security;
alter table public.fi_worker_lock enable row level security;
revoke all on public.fi_employees,public.fi_links,public.fi_transactions,public.fi_notifications,public.fi_worker_lock from anon,authenticated;
grant all on public.fi_employees,public.fi_links,public.fi_transactions,public.fi_notifications,public.fi_worker_lock to service_role;
grant usage,select on sequence public.fi_transactions_row_number_seq,public.fi_notifications_id_seq to service_role;
revoke all on function public.fi_save(text,jsonb,integer,text,text),public.fi_link(text,text,text),public.fi_lock(text),public.fi_unlock(text),public.fi_sync_done(text,integer,text,text) from public,anon,authenticated;
grant execute on function public.fi_save(text,jsonb,integer,text,text),public.fi_link(text,text,text),public.fi_lock(text),public.fi_unlock(text),public.fi_sync_done(text,integer,text,text) to service_role;
commit;
