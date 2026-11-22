-- Wordfinity's persistent semantic embeddings and per-target top-750 rankings.
create table if not exists public.wordfinity_word_embeddings (
  word_key text primary key,
  word text not null,
  category text not null,
  dictionary_sha text not null,
  model text not null,
  embedding jsonb not null,
  computed_at timestamptz not null default now(),
  constraint wordfinity_word_embeddings_embedding_is_array check (jsonb_typeof(embedding) = 'array')
);
create index if not exists wordfinity_word_embeddings_category_idx
  on public.wordfinity_word_embeddings(category);

create table if not exists public.wordfinity_semantic_rankings (
  target_word text primary key,
  category text not null,
  dictionary_sha text not null,
  model text not null,
  candidate_count integer not null check (candidate_count between 1 and 2487),
  rankings jsonb not null,
  computed_at timestamptz not null default now(),
  constraint wordfinity_semantic_rankings_top_750 check (
    jsonb_typeof(rankings) = 'array'
    and jsonb_array_length(rankings) between 1 and 750
  )
);
create index if not exists wordfinity_semantic_rankings_category_idx
  on public.wordfinity_semantic_rankings(category);

alter table public.wordfinity_word_embeddings enable row level security;
alter table public.wordfinity_semantic_rankings enable row level security;
revoke all on public.wordfinity_word_embeddings from anon, authenticated;
revoke all on public.wordfinity_semantic_rankings from anon, authenticated;
grant all on public.wordfinity_word_embeddings to service_role;
grant all on public.wordfinity_semantic_rankings to service_role;
