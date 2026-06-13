import AdminSidebar from '@/components/admin/AdminSidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:flex min-h-screen bg-neutral-100">
      <AdminSidebar />
      <main className="flex-1 min-w-0 p-4 lg:p-8">{children}</main>
    </div>
  );
}
