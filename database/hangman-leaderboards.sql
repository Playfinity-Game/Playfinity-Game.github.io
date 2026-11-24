-- Hangman score events and time-scoped leaderboards.
-- Week starts Monday 00:00 in Europe/Berlin (CET/CEST).
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.hangman_score_events (
  id bigint generated always as identity primary key,
  round_id text not null check (char_length(round_id) between 1 and 80),
  player_key text not null check (char_length(player_key) between 1 and 80),
  display_name text not null check (char_length(display_name) between 1 and 40),
  points integer not null check (points in (1, 10)),
  award_key text not null check (char_length(award_key) between 1 and 32),
  created_at timestamptz not null default now(),
  constraint hangman_score_events_once unique (round_id, player_key, award_key)
);
alter table private.hangman_score_events enable row level security;
revoke all on table private.hangman_score_events from public, anon, authenticated;
create index if not exists hangman_score_events_created_at_idx
  on private.hangman_score_events (created_at desc);

create or replace function public.award_hangman_points(
  p_player_key text, p_display_name text, p_points integer, p_round_id text, p_award_key text
) returns boolean
language plpgsql security definer set search_path = ''
as $function$
declare
  clean_player_key text := pg_catalog.left(pg_catalog.lower(pg_catalog.btrim(p_player_key)), 80);
  clean_display_name text := pg_catalog.left(pg_catalog.btrim(p_display_name), 40);
  clean_round_id text := pg_catalog.left(pg_catalog.btrim(p_round_id), 80);
  clean_award_key text := pg_catalog.left(pg_catalog.btrim(p_award_key), 32);
begin
  if clean_player_key is null or clean_player_key = ''
     or clean_display_name is null or clean_display_name = ''
     or clean_round_id is null or clean_round_id = '' then
    raise exception 'Spieler, Anzeigename und Runde sind erforderlich';
  end if;
  if not (
    (clean_award_key = 'word-solved' and p_points = 10)
    or (clean_award_key ~ '^letter:[A-ZÄÖÜẞ]
    raise exception 'Ungültige Hangman-Punktevergabe';
  end if;
  insert into private.hangman_score_events (round_id, player_key, display_name, points, award_key)
  values (clean_round_id, clean_player_key, clean_display_name, p_points, clean_award_key)
  on conflict (round_id, player_key, award_key) do nothing;
  return found;
end;
$function$;

revoke execute on function public.award_hangman_points(text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.award_hangman_points(text, text, integer, text, text) to anon, authenticated;

create or replace function public.get_hangman_leaderboard(p_period text)
returns table (player_key text, display_name text, points bigint)
language plpgsql stable security definer set search_path = ''
as $function$
declare
  period_start timestamptz;
begin
  if p_period = 'last24hours' then
    period_start := pg_catalog.now() - interval '24 hours';
  elsif p_period = 'weekly' then
    period_start := pg_catalog.date_trunc('week', pg_catalog.timezone('Europe/Berlin', pg_catalog.now()))
                    at time zone 'Europe/Berlin';
  else
    raise exception 'Unbekannter Ranglistenzeitraum';
  end if;
  return query
    select e.player_key, pg_catalog.max(e.display_name), pg_catalog.sum(e.points)::bigint
    from private.hangman_score_events e
    where e.created_at >= period_start
    group by e.player_key
    order by pg_catalog.sum(e.points) desc, pg_catalog.max(e.display_name) asc
    limit 10;
end;
$function$;

revoke execute on function public.get_hangman_leaderboard(text) from public, anon, authenticated;
grant execute on function public.get_hangman_leaderboard(text) to anon, authenticated;
 and p_points = 1)
  ) then
    raise exception 'Ungültige Hangman-Punktevergabe';
  end if;
  insert into private.hangman_score_events (round_id, player_key, display_name, points, award_key)
  values (clean_round_id, clean_player_key, clean_display_name, p_points, clean_award_key)
  on conflict (round_id, player_key, award_key) do nothing;
  return found;
end;
$function$;

revoke execute on function public.award_hangman_points(text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.award_hangman_points(text, text, integer, text, text) to anon, authenticated;

create or replace function public.get_hangman_leaderboard(p_period text)
returns table (player_key text, display_name text, points bigint)
language plpgsql stable security definer set search_path = ''
as $function$
declare
  period_start timestamptz;
begin
  if p_period = 'last24hours' then
    period_start := pg_catalog.now() - interval '24 hours';
  elsif p_period = 'weekly' then
    period_start := pg_catalog.date_trunc('week', pg_catalog.timezone('Europe/Berlin', pg_catalog.now()))
                    at time zone 'Europe/Berlin';
  else
    raise exception 'Unbekannter Ranglistenzeitraum';
  end if;
  return query
    select e.player_key, pg_catalog.max(e.display_name), pg_catalog.sum(e.points)::bigint
    from private.hangman_score_events e
    where e.created_at >= period_start
    group by e.player_key
    order by pg_catalog.sum(e.points) desc, pg_catalog.max(e.display_name) asc
    limit 10;
end;
$function$;

revoke execute on function public.get_hangman_leaderboard(text) from public, anon, authenticated;
grant execute on function public.get_hangman_leaderboard(text) to anon, authenticated;
