alter table profiles 
add column if not exists preferred_language text default 'en';
