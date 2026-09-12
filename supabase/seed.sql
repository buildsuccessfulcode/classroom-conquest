-- Classroom Conquest — Bank soal contoh (opsional)
-- Membuat group soal contoh lalu mengisinya bila group masih kosong.

insert into public.question_groups (name, subject)
values
    ('Contoh English', 'English'),
    ('Contoh Coding', 'Coding'),
    ('Contoh DDPK', 'DDPK')
on conflict (name) do nothing;

insert into public.questions
    (group_id, subject, type, difficulty, question_text, metadata, correct_answer, points)
select
    g.id,
    seed.subject,
    seed.type,
    seed.difficulty,
    seed.question_text,
    seed.metadata,
    seed.correct_answer,
    seed.points
from (
    values
        (
            'English',
            'MULTIPLE_CHOICE',
            'EASY',
            'Which sentence is grammatically CORRECT for past activities?',
            '{"options":["She goes to school yesterday.","She went to school yesterday.","She is going to school yesterday.","She has go to school yesterday."]}'::jsonb,
            'She went to school yesterday.',
            100
        ),
        (
            'Coding',
            'SHORT_ANSWER',
            'MEDIUM',
            'Isi bagian kosong agar tipe data variabel terdeteksi sebagai array:',
            '{"code_snippet":"const data = [];\nconsole.log(Array.____(data)); // output: true"}'::jsonb,
            'isArray',
            150
        ),
        (
            'DDPK',
            'MULTIPLE_CHOICE',
            'EASY',
            'Tindakan utama dalam pencegahan kecelakaan kerja K3LH di laboratorium komputer adalah...',
            '{"options":["Membawa makanan ke dekat CPU","Memastikan manajemen kabel rapi dan grounded","Menyiram air saat terjadi korsleting","Meninggalkan kabel terkelupas"]}'::jsonb,
            'Memastikan manajemen kabel rapi dan grounded',
            100
        ),
        (
            'English',
            'REARRANGE_WORDS',
            'MEDIUM',
            'Susun menjadi kalimat yang benar.',
            '{"words":["The","students","are","reading","a","book"]}'::jsonb,
            'The students are reading a book',
            150
        ),
        (
            'Coding',
            'MULTIPLE_CHOICE',
            'HARD',
            'Struktur data mana yang menerapkan prinsip LIFO (Last In First Out)?',
            '{"options":["Queue","Stack","Linked List","Graph"]}'::jsonb,
            'Stack',
            200
        )
) as seed(subject, type, difficulty, question_text, metadata, correct_answer, points)
join public.question_groups g on g.name = 'Contoh ' || seed.subject
where not exists (
    select 1 from public.questions q where q.group_id = g.id
);
