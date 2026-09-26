-- PROXITI Academia V13. Avaliações corrigidas no servidor e certificado interno.
-- Nenhum registro de usuário é criado por esta migração. Conteúdo e gabarito:
-- supabase/academy_assessment_bank_v13.sql. Versão fixa para não alterar notas antigas.

create table if not exists public.academy_courses(
 code text primary key check(code ~ '^[a-z][a-z0-9_-]{2,39}$'),
 track_id text not null check(track_id ~ '^[a-z][a-z0-9_-]{2,39}$'),
 title text not null check(length(btrim(title)) between 5 and 140),
 sort_order integer not null unique,
 curriculum_version text not null default '2026-09-v1',
 required boolean not null default true,
 active boolean not null default true
);
create table if not exists public.academy_questions(
 code text primary key check(code ~ '^[a-z][a-z0-9_-]{2,63}$'),
 course_id text references public.academy_courses(code) on delete restrict,
 track_id text not null,
 exam boolean not null default false,
 sort_order integer not null,
 prompt text not null check(length(btrim(prompt)) between 20 and 1200),
 options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options)=4),
 correct_index integer not null check(correct_index between 0 and 3),
 explanation text not null check(length(btrim(explanation)) between 20 and 1600),
 critical boolean not null default false,
 curriculum_version text not null default '2026-09-v1',
 unique(course_id,sort_order,curriculum_version),
 check((exam and course_id is null) or (not exam and course_id is not null))
);
create index if not exists academy_questions_assessment_idx
 on public.academy_questions(curriculum_version,exam,course_id,sort_order);

create table if not exists public.academy_course_progress(
 user_id uuid not null references auth.users(id) on delete cascade,
 course_id text not null references public.academy_courses(code) on delete restrict,
 curriculum_version text not null default '2026-09-v1',
 best_score numeric(5,2) not null default 0 check(best_score between 0 and 100),
 last_score numeric(5,2) not null default 0 check(last_score between 0 and 100),
 attempts integer not null default 0 check(attempts>=0),
 completed_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(user_id,course_id,curriculum_version)
);
create table if not exists public.academy_quiz_attempts(
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 course_id text not null references public.academy_courses(code) on delete restrict,
 curriculum_version text not null default '2026-09-v1',
 answers jsonb not null,
 correct_count integer not null,
 total integer not null,
 score numeric(5,2) not null check(score between 0 and 100),
 passed boolean not null,
 created_at timestamptz not null default now()
);
create index if not exists academy_quiz_attempts_owner_idx
 on public.academy_quiz_attempts(user_id,course_id,created_at desc);

create table if not exists public.academy_exam_attempts(
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 curriculum_version text not null default '2026-09-v1',
 answers jsonb not null,
 correct_count integer not null,
 total integer not null,
 exam_score numeric(5,2) not null check(exam_score between 0 and 100),
 quiz_average numeric(5,2) not null check(quiz_average between 0 and 100),
 overall_score numeric(5,2) not null check(overall_score between 0 and 100),
 critical_correct boolean not null,
 passed boolean not null,
 created_at timestamptz not null default now()
);
create index if not exists academy_exam_attempts_owner_idx
 on public.academy_exam_attempts(user_id,created_at desc);

create table if not exists public.academy_certificates(
 id uuid primary key default gen_random_uuid(),
 verification_code text not null unique,
 user_id uuid not null references auth.users(id) on delete cascade,
 holder_name text not null check(length(btrim(holder_name)) between 3 and 160),
 curriculum_version text not null default '2026-09-v1',
 course_count integer not null check(course_count>=16),
 quiz_average numeric(5,2) not null check(quiz_average between 0 and 100),
 exam_score numeric(5,2) not null check(exam_score between 0 and 100),
 overall_score numeric(5,2) not null check(overall_score between 0 and 100),
 exam_attempt_id bigint references public.academy_exam_attempts(id) on delete restrict,
 issued_at timestamptz not null default now(),
 unique(user_id,curriculum_version)
);

alter table public.academy_courses enable row level security;
alter table public.academy_questions enable row level security;
alter table public.academy_course_progress enable row level security;
alter table public.academy_quiz_attempts enable row level security;
alter table public.academy_exam_attempts enable row level security;
alter table public.academy_certificates enable row level security;

revoke all on public.academy_courses,public.academy_questions,
 public.academy_course_progress,public.academy_quiz_attempts,
 public.academy_exam_attempts,public.academy_certificates from public,anon,authenticated;
grant select on public.academy_courses,public.academy_course_progress,
 public.academy_quiz_attempts,public.academy_exam_attempts,
 public.academy_certificates to authenticated;
-- O gabarito de academy_questions NUNCA recebe SELECT de authenticated.

drop policy if exists academy_courses_reader on public.academy_courses;
create policy academy_courses_reader on public.academy_courses for select to authenticated
 using(public.proxiti_is_admin() or public.proxiti_can('training'));
drop policy if exists academy_progress_own on public.academy_course_progress;
create policy academy_progress_own on public.academy_course_progress for select to authenticated
 using(user_id=(select auth.uid()) and
  (public.proxiti_is_admin() or public.proxiti_can('training')));
drop policy if exists academy_quiz_own on public.academy_quiz_attempts;
create policy academy_quiz_own on public.academy_quiz_attempts for select to authenticated
 using(user_id=(select auth.uid()) and
  (public.proxiti_is_admin() or public.proxiti_can('training')));
drop policy if exists academy_exam_own on public.academy_exam_attempts;
create policy academy_exam_own on public.academy_exam_attempts for select to authenticated
 using(user_id=(select auth.uid()) and
  (public.proxiti_is_admin() or public.proxiti_can('training')));
drop policy if exists academy_certificate_own on public.academy_certificates;
create policy academy_certificate_own on public.academy_certificates for select to authenticated
 using(user_id=(select auth.uid()) and
  (public.proxiti_is_admin() or public.proxiti_can('training')));

create or replace function public.proxiti_academy_questions(p_course text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare required_count integer; finished_count integer; result jsonb;
begin
 if (select auth.uid()) is null or not
  (public.proxiti_is_admin() or public.proxiti_can('training'))
 then raise exception 'Academia não autorizada'; end if;
 if p_course is null then
  select count(*) into required_count from public.academy_courses
    where active and required and curriculum_version='2026-09-v1';
  select count(*) into finished_count from public.academy_courses c
    join public.academy_course_progress p on p.course_id=c.code
      and p.curriculum_version=c.curriculum_version
    where c.active and c.required and c.curriculum_version='2026-09-v1'
      and p.user_id=(select auth.uid()) and p.completed_at is not null;
  if required_count<16 or finished_count<>required_count then
   raise exception 'Conclua os 16 questionários antes da prova final'; end if;
 else
  if not exists(select 1 from public.academy_courses
    where code=p_course and active and curriculum_version='2026-09-v1')
  then raise exception 'Curso não disponível'; end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('code',q.code,
   'prompt',q.prompt,'options',q.options,'track_id',q.track_id,
   'critical',q.critical) order by q.sort_order,q.code),'[]'::jsonb)
 into result from public.academy_questions q
 where q.curriculum_version='2026-09-v1'
   and ((p_course is null and q.exam) or
     (p_course is not null and not q.exam and q.course_id=p_course));
 return result;
end; $$;
revoke all on function public.proxiti_academy_questions(text) from public,anon;
grant execute on function public.proxiti_academy_questions(text) to authenticated;

create or replace function public.proxiti_academy_submit_quiz(
 p_course text,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare total integer; correct integer; score numeric(5,2);
 passing boolean; review jsonb;
begin
 if (select auth.uid()) is null or not
  (public.proxiti_is_admin() or public.proxiti_can('training'))
 then raise exception 'Academia não autorizada'; end if;
 if p_course is null or not exists(select 1 from public.academy_courses
   where code=p_course and active and curriculum_version='2026-09-v1')
 then raise exception 'Curso não disponível'; end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object'
 then raise exception 'Respostas inválidas'; end if;
 select count(*) into total from public.academy_questions
  where curriculum_version='2026-09-v1' and not exam and course_id=p_course;
 if total<>4 or (select count(*) from jsonb_object_keys(p_answers))<>total
   or exists(select 1 from jsonb_object_keys(p_answers) k
     where not exists(select 1 from public.academy_questions q
       where q.code=k and q.course_id=p_course and not q.exam
       and q.curriculum_version='2026-09-v1'))
 then raise exception 'Responda às quatro perguntas deste curso'; end if;
 if exists(select 1 from public.academy_questions q
   where q.course_id=p_course and not q.exam and q.curriculum_version='2026-09-v1'
     and ((p_answers->>q.code) is null or (p_answers->>q.code)!~'^[0-3]$'))
 then raise exception 'Alternativa inválida'; end if;
 select count(*) filter(where (p_answers->>q.code)::integer=q.correct_index),
  coalesce(jsonb_agg(jsonb_build_object(
   'code',q.code,'correct',(p_answers->>q.code)::integer=q.correct_index,
   'correct_index',q.correct_index,'explanation',q.explanation)
   order by q.sort_order),'[]'::jsonb)
 into correct,review
 from public.academy_questions q
 where q.course_id=p_course and not q.exam and q.curriculum_version='2026-09-v1';
 score:=round(correct*100.0/total,2);passing:=score>=75;
 insert into public.academy_quiz_attempts(
  user_id,course_id,answers,correct_count,total,score,passed)
 values((select auth.uid()),p_course,p_answers,correct,total,score,passing);
 insert into public.academy_course_progress(
  user_id,course_id,best_score,last_score,attempts,completed_at)
 values((select auth.uid()),p_course,score,score,1,
   case when passing then now() else null end)
 on conflict(user_id,course_id,curriculum_version) do update set
 best_score=greatest(public.academy_course_progress.best_score,excluded.best_score),
 last_score=excluded.last_score,attempts=public.academy_course_progress.attempts+1,
 completed_at=coalesce(public.academy_course_progress.completed_at,excluded.completed_at),
 updated_at=now();
 return jsonb_build_object('score',score,'correct',correct,'total',total,
  'passed',passing,'review',review);
end; $$;
revoke all on function public.proxiti_academy_submit_quiz(text,jsonb) from public,anon;
grant execute on function public.proxiti_academy_submit_quiz(text,jsonb) to authenticated;

create or replace function public.proxiti_academy_submit_exam(p_answers jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare total integer;correct integer;critical_ok boolean; score numeric(5,2);
 quiz_avg numeric(5,2);final_score numeric(5,2);passed boolean;
 required_count integer;finished_count integer;attempt_id bigint;
 grade_by_track jsonb; holder text; certificate public.academy_certificates%rowtype;
begin
 if (select auth.uid()) is null or not
  (public.proxiti_is_admin() or public.proxiti_can('training'))
 then raise exception 'Academia não autorizada'; end if;
 select count(*) into required_count from public.academy_courses
  where active and required and curriculum_version='2026-09-v1';
 select count(*),round(avg(p.best_score),2)
 into finished_count,quiz_avg from public.academy_courses c
 join public.academy_course_progress p on p.course_id=c.code
   and p.curriculum_version=c.curriculum_version
 where c.active and c.required and c.curriculum_version='2026-09-v1'
   and p.user_id=(select auth.uid()) and p.completed_at is not null;
 if required_count<16 or finished_count<>required_count then
  raise exception 'Todos os 16 cursos devem ser concluídos para a prova'; end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object'
 then raise exception 'Respostas inválidas'; end if;
 select count(*) into total from public.academy_questions
  where curriculum_version='2026-09-v1' and exam;
 if total<>24 or (select count(*) from jsonb_object_keys(p_answers))<>total
   or exists(select 1 from jsonb_object_keys(p_answers) k
    where not exists(select 1 from public.academy_questions q
      where q.code=k and q.exam and q.curriculum_version='2026-09-v1'))
 then raise exception 'Responda às 24 perguntas da prova'; end if;
 if exists(select 1 from public.academy_questions q
   where q.exam and q.curriculum_version='2026-09-v1'
     and ((p_answers->>q.code) is null or (p_answers->>q.code)!~'^[0-3]$'))
 then raise exception 'Alternativa inválida'; end if;
 select count(*) filter(where (p_answers->>q.code)::integer=q.correct_index),
   coalesce(bool_and((p_answers->>q.code)::integer=q.correct_index)
     filter(where q.critical),false)
 into correct,critical_ok from public.academy_questions q
 where q.exam and q.curriculum_version='2026-09-v1';
 score:=round(correct*100.0/total,2);
 final_score:=round(quiz_avg*0.60+score*0.40,2);
 passed:=score>=75 and final_score>=80 and critical_ok;
 select coalesce(jsonb_object_agg(track_id,track_result),'{}'::jsonb)
 into grade_by_track from (
  select q.track_id,jsonb_build_object(
   'correct',count(*) filter(where (p_answers->>q.code)::integer=q.correct_index),
   'total',count(*)) as track_result
  from public.academy_questions q
  where q.exam and q.curriculum_version='2026-09-v1'
  group by q.track_id
 ) t;
 insert into public.academy_exam_attempts(
  user_id,answers,correct_count,total,exam_score,quiz_average,
  overall_score,critical_correct,passed)
 values((select auth.uid()),p_answers,correct,total,score,quiz_avg,
   final_score,critical_ok,passed) returning id into attempt_id;
 if passed then
  select nullif(btrim(p.display_name),'') into holder
    from public.profiles p where p.id=(select auth.uid());
  if holder is null or length(holder)<3 then
   raise exception 'Defina seu nome completo no Perfil antes de emitir o certificado';
  end if;
  insert into public.academy_certificates(
   verification_code,user_id,holder_name,course_count,
   quiz_average,exam_score,overall_score,exam_attempt_id)
  values('PXI-ACA-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),
    (select auth.uid()),holder,finished_count,quiz_avg,score,final_score,attempt_id)
  on conflict(user_id,curriculum_version) do nothing;
  select * into certificate from public.academy_certificates
   where user_id=(select auth.uid()) and curriculum_version='2026-09-v1';
 end if;
 return jsonb_build_object('score',score,'quiz_average',quiz_avg,
   'overall_score',final_score,'correct',correct,'total',total,
   'critical_correct',critical_ok,'passed',passed,
   'by_track',grade_by_track,
   'certificate',case when certificate.id is not null then
     jsonb_build_object('id',certificate.id,'code',certificate.verification_code,
       'name',certificate.holder_name,'issued_at',certificate.issued_at,
       'score',certificate.overall_score) else null end);
end; $$;
revoke all on function public.proxiti_academy_submit_exam(jsonb) from public,anon;
grant execute on function public.proxiti_academy_submit_exam(jsonb) to authenticated;

-- Para obter apenas status mínimo por código sem expor nome, nota ou email.
create or replace function public.proxiti_academy_verify_certificate(p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare found boolean;
begin
 if p_code is null or length(p_code)>64 then return jsonb_build_object('valid',false); end if;
 select exists(select 1 from public.academy_certificates
   where verification_code=p_code) into found;
 return jsonb_build_object('valid',found,'type','interno','issuer','PROXITI');
end; $$;
revoke all on function public.proxiti_academy_verify_certificate(text) from public,anon;
grant execute on function public.proxiti_academy_verify_certificate(text) to authenticated;
