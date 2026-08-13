-- Migration 0011: Admin Category Roles (Super, DI, PE)

alter table admin_emails
add column if not exists role text not null default 'super' check (role in ('super', 'di', 'pe'));

-- Insert/update specified admin emails with their designated category management roles
insert into admin_emails (email, role, note) values
  ('thaikphams@gmail.com', 'super', 'Super Dev / Full Site Admin (DI & PE)'),
  ('thaikpham.art@gmail.com', 'super', 'Super Dev / Full Site Admin (DI & PE)'),
  ('trungnguyen.fwr@gmail.com', 'di', 'DI Admin (Digital Imaging: Cameras, Lenses, Accessories)'),
  ('nghiemtrancong.sony@gmail.com', 'pe', 'PE Admin (Personal Entertainment: Headphones, Speakers, Audio)')
on conflict (email) do update set
  role = excluded.role,
  note = excluded.note;
